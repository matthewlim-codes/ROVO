import { Router } from "express";
import { db } from "@workspace/db";
import {
  cityImagesTable,
  insertCityImageSchema,
  tournamentsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { routeParam } from "../lib/matching";
import { writeAudit } from "../lib/jobRunner";
import { z } from "zod/v4";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const router = Router();

const ALLOWED_REMOTE_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
]);

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function publicDir() {
  return path.join(process.cwd(), "public", "city-images");
}

async function ensureDir() {
  await fs.mkdir(publicDir(), { recursive: true });
}

router.get("/city-images", requireAdminAuth, async (_req, res) => {
  try {
    return res.json(await db.select().from(cityImagesTable));
  } catch {
    return res.status(500).json({ error: "Failed to list city images" });
  }
});

router.post("/city-images", requireAdminAuth, async (req, res) => {
  const parsed = insertCityImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  try {
    if (!parsed.data.attribution?.trim() && !parsed.data.isPlaceholder) {
      return res.status(400).json({
        error: "Attribution is required for non-placeholder city images",
      });
    }
    const [row] = await db.insert(cityImagesTable).values(parsed.data).returning();
    await writeAudit({
      action: "city_image.create",
      entityType: "city_image",
      entityId: row.id,
      after: row,
    });
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "Failed to create city image" });
  }
});

router.put("/city-images/:id", requireAdminAuth, async (req, res) => {
  const id = routeParam(req.params.id);
  if (!id) return res.status(400).json({ error: "id required" });
  const parsed = insertCityImageSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  try {
    const [row] = await db
      .update(cityImagesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(cityImagesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      action: "city_image.update",
      entityType: "city_image",
      entityId: id,
      after: row,
    });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Failed to update city image" });
  }
});

/**
 * Download a licensed image from an allow-listed host (e.g. Wikimedia Commons)
 * and store it under /api/static/city-images/. Never scrapes Google Images.
 */
router.post("/city-images/import-remote", requireAdminAuth, async (req, res) => {
  const parsed = z
    .object({
      city: z.string().min(1),
      state: z.string().default("CA"),
      remoteUrl: z.string().url(),
      attribution: z.string().min(1),
      license: z.string().min(1),
      sourceUrl: z.string().url().optional(),
      altText: z.string().default(""),
      photographer: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const url = new URL(parsed.data.remoteUrl);
    if (url.protocol !== "https:" || !ALLOWED_REMOTE_HOSTS.has(url.hostname)) {
      return res.status(400).json({
        error:
          "Remote URL host not allowed. Use an approved licensed source (e.g. upload.wikimedia.org) or upload a file.",
      });
    }
    const resp = await fetch(parsed.data.remoteUrl, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      return res.status(400).json({ error: `Upstream HTTP ${resp.status}` });
    }
    const ctype = resp.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_MIME.has(ctype)) {
      return res.status(400).json({ error: `Unsupported content type: ${ctype}` });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return res.status(400).json({ error: "Image exceeds 5MB limit" });
    }
    await ensureDir();
    const ext = ctype === "image/png" ? "png" : ctype === "image/webp" ? "webp" : "jpg";
    const filename = `${parsed.data.city.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const storagePath = `/api/static/city-images/${filename}`;
    await fs.writeFile(path.join(publicDir(), filename), buf);

    const [row] = await db
      .insert(cityImagesTable)
      .values({
        city: parsed.data.city,
        state: parsed.data.state,
        storagePath,
        remoteUrl: parsed.data.remoteUrl,
        attribution: parsed.data.attribution,
        license: parsed.data.license,
        sourceUrl: parsed.data.sourceUrl ?? parsed.data.remoteUrl,
        altText: parsed.data.altText || `${parsed.data.city}, ${parsed.data.state}`,
        photographer: parsed.data.photographer ?? null,
        isPlaceholder: false,
      })
      .returning();
    await writeAudit({
      action: "city_image.import_remote",
      entityType: "city_image",
      entityId: row.id,
      after: row,
    });
    return res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Import failed",
    });
  }
});

/** Base64 upload from admin UI (validated MIME + size). */
router.post("/city-images/upload", requireAdminAuth, async (req, res) => {
  const parsed = z
    .object({
      city: z.string().min(1),
      state: z.string().default("CA"),
      filename: z.string().min(1),
      contentBase64: z.string().min(1),
      mimeType: z.string(),
      attribution: z.string().min(1),
      license: z.string().min(1),
      altText: z.string().default(""),
      photographer: z.string().optional(),
      sourceUrl: z.string().url().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  if (!ALLOWED_MIME.has(parsed.data.mimeType)) {
    return res.status(400).json({ error: "Unsupported mime type" });
  }
  try {
    const buf = Buffer.from(parsed.data.contentBase64, "base64");
    if (buf.byteLength > MAX_BYTES) {
      return res.status(400).json({ error: "Image exceeds 5MB limit" });
    }
    await ensureDir();
    const ext =
      parsed.data.mimeType === "image/png"
        ? "png"
        : parsed.data.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const filename = `${parsed.data.city.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(publicDir(), filename), buf);
    const storagePath = `/api/static/city-images/${filename}`;
    const [row] = await db
      .insert(cityImagesTable)
      .values({
        city: parsed.data.city,
        state: parsed.data.state,
        storagePath,
        attribution: parsed.data.attribution,
        license: parsed.data.license,
        altText: parsed.data.altText || `${parsed.data.city}, ${parsed.data.state}`,
        photographer: parsed.data.photographer ?? null,
        sourceUrl: parsed.data.sourceUrl ?? null,
        isPlaceholder: false,
      })
      .returning();
    await writeAudit({
      action: "city_image.upload",
      entityType: "city_image",
      entityId: row.id,
      after: row,
    });
    return res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Upload failed",
    });
  }
});

router.post(
  "/tournaments/:id/assign-city-image",
  requireAdminAuth,
  async (req, res) => {
    const id = routeParam(req.params.id);
    if (!id) return res.status(400).json({ error: "id required" });
    const parsed = z
      .object({
        cityImageId: z.string().uuid().nullable(),
        /** Direct override when no city-library image is selected. */
        imageUrl: z.string().nullable().optional(),
        imageAltText: z.string().nullish(),
        imageCredit: z.string().nullish(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues
          .map((i) =>
            i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
          )
          .join("; "),
      });
    }
    try {
      let nextImageUrl: string | null | undefined = undefined;
      let credit = parsed.data.imageCredit;
      let alt = parsed.data.imageAltText;
      if (parsed.data.cityImageId) {
        const [img] = await db
          .select()
          .from(cityImagesTable)
          .where(eq(cityImagesTable.id, parsed.data.cityImageId))
          .limit(1);
        if (!img) return res.status(404).json({ error: "City image not found" });
        nextImageUrl = img.storagePath ?? img.remoteUrl;
        credit = credit ?? img.attribution;
        alt = alt ?? img.altText;
      } else if (parsed.data.imageUrl !== undefined) {
        // Explicit Image URL (or clear). Do not wipe an existing URL when the
        // field is omitted — only when imageUrl is sent as null/"".
        nextImageUrl = parsed.data.imageUrl || null;
      }

      const patch: Record<string, unknown> = {
        cityImageId: parsed.data.cityImageId,
        imageAltText: alt ?? null,
        imageCredit: credit ?? null,
        updatedAt: new Date(),
      };
      if (nextImageUrl !== undefined) {
        patch.imageUrl = nextImageUrl;
      }

      const [row] = await db
        .update(tournamentsTable)
        .set(patch)
        .where(eq(tournamentsTable.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: "Tournament not found" });
      return res.json(row);
    } catch {
      return res.status(500).json({ error: "Failed to assign image" });
    }
  },
);

export default router;

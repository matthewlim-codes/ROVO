import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Licensed city photos with required attribution/provenance. */
export const cityImagesTable = pgTable("city_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  city: text("city").notNull(),
  state: text("state").notNull().default("CA"),
  /** Path under /api/static/… or null when using placeholder. */
  storagePath: text("storage_path"),
  remoteUrl: text("remote_url"),
  altText: text("alt_text").notNull().default(""),
  attribution: text("attribution").notNull().default(""),
  license: text("license").notNull().default(""),
  sourceUrl: text("source_url"),
  photographer: text("photographer"),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCityImageSchema = createInsertSchema(cityImagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectCityImageSchema = createSelectSchema(cityImagesTable);

export type CityImage = typeof cityImagesTable.$inferSelect;
export type InsertCityImage = z.infer<typeof insertCityImageSchema>;

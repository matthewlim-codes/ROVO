import type { Request, Response, NextFunction } from "express";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Protects scheduler-triggered job endpoints.
 * Accepts Authorization: Bearer <JOB_SECRET> or X-Job-Secret header.
 */
export function requireJobSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.JOB_SECRET;
  if (!expected) {
    res
      .status(503)
      .json({ error: "JOB_SECRET is not configured on the server" });
    return;
  }

  const header = req.headers.authorization;
  let provided: string | undefined;
  if (header?.startsWith("Bearer ")) {
    provided = header.slice(7);
  } else if (typeof req.headers["x-job-secret"] === "string") {
    provided = req.headers["x-job-secret"];
  }

  if (!provided || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

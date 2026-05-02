import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export interface AuthedRequest extends Request {
  authUserId: string;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  if (auth?.userId) {
    (req as AuthedRequest).authUserId = auth.userId;
    next();
    return;
  }
  // Allow guest access — device-generated ID passed from mobile
  const guestId = req.headers["x-guest-id"];
  if (typeof guestId === "string" && guestId.startsWith("guest-")) {
    (req as AuthedRequest).authUserId = guestId;
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

export function getUserId(req: Request): string {
  return (req as AuthedRequest).authUserId;
}

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
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).authUserId = auth.userId;
  next();
}

export function getUserId(req: Request): string {
  return (req as AuthedRequest).authUserId;
}

import type { Request, Response, NextFunction } from "express";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  const sendChallenge = (message: string, status = 401) => {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Rovo Admin", charset="UTF-8"',
    );
    res.status(status).type("text/plain").send(message);
  };

  if (!expectedUser || !expectedPass) {
    res
      .status(503)
      .type("text/plain")
      .send(
        "Admin access is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD on the server.",
      );
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    sendChallenge("Authentication required.");
    return;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    sendChallenge("Invalid credentials.");
    return;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) {
    sendChallenge("Invalid credentials.");
    return;
  }
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  if (
    !timingSafeEqual(user, expectedUser) ||
    !timingSafeEqual(pass, expectedPass)
  ) {
    sendChallenge("Invalid credentials.");
    return;
  }

  next();
}

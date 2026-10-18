import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { parseTz } from "../lib/tz.js";

declare global {
  namespace Express {
    interface Request {
      /** Browser timezone offset (minutes) from the X-TZ-Offset header; set by requireAuth. */
      tz: number;
    }
  }
}

export interface AuthedRequest extends Request {
  userId?: string;
}

const savedTz = new Map<string, number>();

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
    req.userId = payload.userId;
    req.tz = parseTz(req.headers["x-tz-offset"]);
    // Remember it on the user so background code (achievements, the coach) groups days the
    // same way the UI does; only writes when it actually changes.
    if (req.headers["x-tz-offset"] !== undefined && savedTz.get(payload.userId) !== req.tz) {
      savedTz.set(payload.userId, req.tz);
      prisma.user.update({ where: { id: payload.userId }, data: { tzOffsetMin: req.tz } }).catch(() => savedTz.delete(payload.userId));
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

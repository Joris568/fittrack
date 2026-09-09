import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../env.js";
import { getOrCreateSingleUser } from "../db.js";
import type { AuthedRequest } from "./middleware.js";

export const authRouter = Router();

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

authRouter.post("/login", async (req, res) => {
  const { passphrase } = req.body ?? {};
  if (typeof passphrase !== "string" || !safeEqual(passphrase, env.appPassword)) {
    return res.status(401).json({ error: "Onjuist wachtwoord" });
  }
  const user = await getOrCreateSingleUser(env.userEmail);
  const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "180d" });
  res.cookie("session", token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

authRouter.get("/me", (req: AuthedRequest, res) => {
  const token = req.cookies?.session;
  if (!token) return res.json({ authenticated: false });
  try {
    jwt.verify(token, env.jwtSecret);
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
});

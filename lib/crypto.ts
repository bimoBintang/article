import crypto from "crypto";

export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

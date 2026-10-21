import { compare, hash } from "bcryptjs";
import { query, queryOne } from "./db";

export const sessionOptions = {
  password: process.env.SESSION_PASSWORD!, // must be at least 32 characters
  cookieName: "ekatalog_session",
  ttl: 60 * 60 * 24 * 7, // 7 days (dalam detik)
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export type SessionData = {
  userId?: string;
  email?: string;
  role?: string;
  isLoggedIn?: boolean;
};

export async function authenticateAdmin(email: string, password: string) {
  const user = await queryOne<{ id: string; email: string; password_hash: string; role: string }>(
    `SELECT id, email, password_hash, role FROM admin_users WHERE email = $1`,
    [email]
  );

  if (!user) {
    return { success: false, error: "Email atau kata sandi salah." };
  }

  const valid = await compare(password, user.password_hash);
  if (!valid) {
    return { success: false, error: "Email atau kata sandi salah." };
  }

  return {
    success: true,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export function generateRequestNumber() {
  const prefix = "REQ";
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `${prefix}-${random}`;
}

export function generateOrderId() {
  const prefix = "INV";
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `${prefix}-${random}`;
}

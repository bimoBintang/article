import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "./auth";

export async function getCurrentSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

export async function isAdmin(): Promise<boolean> {
  const session = await getCurrentSession();
  return session.isLoggedIn === true && session.role === "admin";
}

export async function createAdminSession(user: { id: string; email: string; role: string }) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.userId = user.id;
  session.email = user.email;
  session.role = user.role;
  session.isLoggedIn = true;
  await session.save();
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  await session.destroy();
}

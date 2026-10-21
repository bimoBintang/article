import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";

export async function GET() {
  const session = await getCurrentSession();
  return NextResponse.json({
    isLoggedIn: session.isLoggedIn === true,
    user: session.userId
      ? { id: session.userId, email: session.email, role: session.role }
      : null,
  });
}

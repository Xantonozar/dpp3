import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

function configureEnvFromReq(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.url.startsWith("https") ? "https" : "http");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    (typeof window !== "undefined" ? window.location.host : "");
  if (host) {
    process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  configureEnvFromReq(req);
  const handler = NextAuth(authOptions);
  return handler(req, ctx);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  configureEnvFromReq(req);
  const handler = NextAuth(authOptions);
  return handler(req, ctx);
}

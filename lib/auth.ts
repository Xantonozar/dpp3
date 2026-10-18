import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { dbConnect } from "./db";
import { User } from "./models/User";

// Support AI Studio preview container and Vercel deployments automatically
if (process.env.APP_URL) {
  process.env.NEXTAUTH_URL = process.env.APP_URL;
} else if (process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

const isHttps =
  Boolean(process.env.APP_URL?.startsWith("https")) ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.VERCEL_URL) ||
  Boolean(process.env.NEXTAUTH_URL?.startsWith("https")) ||
  process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "garment-dpp-dev-secret-key-default-32ch",
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  useSecureCookies: isHttps,
  cookies: {
    sessionToken: {
      name: isHttps ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
        secure: isHttps,
      },
    },
    callbackUrl: {
      name: isHttps ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: isHttps ? "none" : "lax",
        path: "/",
        secure: isHttps,
      },
    },
    csrfToken: {
      name: isHttps ? "__Secure-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
        secure: isHttps,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        await dbConnect();
        const user = await User.findOne({ email, active: true }).select(
          "+passwordHash"
        );
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: String(user._id),
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        } as unknown as { id: string; email: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as unknown as { id: string }).id;
        token.role = (user as unknown as { role?: string }).role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { id?: string }).id = token.sub;
        (session.user as unknown as { role?: unknown }).role =
          token.role ?? "admin";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return url;
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
        return parsed.pathname + parsed.search;
      } catch {
        return "/products";
      }
    },
  },
};

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role?: string } | undefined)
    ?.role;
  if (!session?.user || role !== "admin") {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return session;
}

export function toHttpError(e: unknown) {
  const status =
    typeof e === "object" && e && "status" in e
      ? Number((e as { status: unknown }).status) || 500
      : 500;
  const message = e instanceof Error ? e.message : "Server error";
  return { status, message };
}

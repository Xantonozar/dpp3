"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? "/products";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: next,
      });

      setBusy(false);

      if (
        !res ||
        res.error ||
        !res.ok ||
        res.url?.includes("error=") ||
        res.url?.includes("csrf=true")
      ) {
        setError("Invalid email or password.");
        return;
      }

      // Successful login -> route to destination or default to /products
      let target =
        next && next.startsWith("/") && next !== "/login" && next !== "/"
          ? next
          : "/products";

      if (res.url) {
        try {
          const parsed = new URL(res.url);
          if (
            parsed.pathname &&
            parsed.pathname !== "/" &&
            parsed.pathname !== "/login" &&
            !parsed.pathname.includes("/api/auth")
          ) {
            target = parsed.pathname + parsed.search;
          }
        } catch {
          // ignore
        }
      }

      window.location.href = target;
    } catch {
      setBusy(false);
      setError("Unable to sign in. Please verify your credentials and try again.");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md p-8">
        <p className="text-xs font-black tracking-widest text-forest-500">
          GARMENT DPP
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-forest-950">
          Admin login
        </h1>
        <p className="mt-1 text-sm text-forest-900/60">
          Single admin. No sign-up — accounts are seeded via{" "}
          <code className="rounded bg-forest-50 px-1 font-mono text-xs">
            npm run create-user
          </code>
          .
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

"use client";

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
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      const callbackUrl =
        next && next.startsWith("/") && next !== "/login" && next !== "/"
          ? next
          : "/products";

      const body = new URLSearchParams({
        email: email.trim().toLowerCase(),
        password,
        csrfToken: csrfToken || "",
        callbackUrl,
        json: "true",
      });

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await res.json().catch(() => ({}));
      setBusy(false);

      if (
        !res.ok ||
        !data.url ||
        data.url.includes("error=") ||
        data.url.includes("csrf=true")
      ) {
        setError("Invalid email or password.");
        return;
      }

      window.location.href = callbackUrl;
    } catch {
      setBusy(false);
      setError("Unable to connect to the server. Please check your network and try again.");
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
          <div className="rounded-xl border border-forest-200 bg-forest-50/70 p-3 text-xs text-forest-900">
            <p className="font-bold text-forest-950">🔑 Verified Admin Credentials:</p>
            <div className="mt-1 flex flex-col gap-1 text-[11px]">
              <div>
                <span className="font-semibold text-forest-800">Email:</span>{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-forest-950">
                  admin@example.com
                </code>
              </div>
              <div>
                <span className="font-semibold text-forest-800">Password:</span>{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-forest-950">
                  admin123
                </code>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@example.com");
                  setPassword("admin123");
                  setError("");
                }}
                className="rounded-lg bg-forest-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-forest-800"
              >
                ⚡ Auto-fill (admin@example.com)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("salmanzadid.official@gmail.com");
                  setPassword("admin123");
                  setError("");
                }}
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-forest-800 ring-1 ring-forest-200 hover:bg-forest-100"
              >
                ⚡ Auto-fill (salmanzadid)
              </button>
            </div>
          </div>

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

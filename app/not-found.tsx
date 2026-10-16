import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-4">
      <div className="card p-10 text-center">
        <p className="text-xs font-black tracking-widest text-forest-500">GARMENT DPP</p>
        <h1 className="mt-2 text-2xl font-black text-forest-950">Page not found</h1>
        <p className="mt-2 text-sm text-forest-900/60">
          The requested page does not exist.
        </p>
        <Link href="/" className="btn-primary mt-4 !py-2 text-xs">Return home</Link>
      </div>
    </main>
  );
}

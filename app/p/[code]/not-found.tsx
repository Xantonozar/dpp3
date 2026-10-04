import Link from "next/link";

export default function PublicNotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-4">
      <div className="card p-10 text-center">
        <p className="text-xs font-black tracking-widest text-forest-500">PRODUCT PASSPORT</p>
        <h1 className="mt-2 text-2xl font-black text-forest-950">Passport not found</h1>
        <p className="mt-2 text-sm text-forest-900/60">
          This QR code or link doesn&apos;t match any product passport.
        </p>
        <Link href="/" className="btn-secondary mt-4 !py-2 text-xs">Back to start</Link>
      </div>
    </main>
  );
}

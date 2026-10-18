import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div className="card max-w-md p-8">
        <p className="text-xs font-black tracking-widest text-forest-500">404</p>
        <h1 className="mt-1 text-2xl font-black text-forest-950">Page not found</h1>
        <p className="mt-2 text-sm text-forest-900/60">
          The requested page could not be found.
        </p>
        <div className="mt-6">
          <Link href="/products" className="btn-primary">
            Go to products
          </Link>
        </div>
      </div>
    </div>
  );
}

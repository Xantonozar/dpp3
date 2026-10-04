import { redirect } from "next/navigation";

// Single-page product form lives at /products/[productId] — keep the old URL working.
export default async function ReviewRedirect({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  redirect(`/products/${productId}#sec-review`);
}

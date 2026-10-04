export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Section navigation lives on the single product page (sticky anchor bar).
  return <div>{children}</div>;
}

import { AdminNav } from "@/components/AdminNav";
import { TourProvider } from "@/components/tour/TourProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <TourProvider />
      <aside className="flex flex-col bg-forest-950 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <AdminNav />
      </aside>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </div>
    </div>
  );
}

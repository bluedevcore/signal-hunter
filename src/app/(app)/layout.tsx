import { Sidebar } from "@/components/Sidebar";
import { sidebarCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // One round trip: if the tables don't exist yet the count query fails and we show no counts.
  const counts = await sidebarCounts().catch(() => ({ leads: null, today: null }));
  return (
    <div className="min-h-screen flex flex-wrap items-stretch">
      <Sidebar leads={counts.leads} today={counts.today} />
      <main className="box-border flex flex-col gap-5 px-6 md:px-12 pt-6 pb-16" style={{ flex: "999 1 560px", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}

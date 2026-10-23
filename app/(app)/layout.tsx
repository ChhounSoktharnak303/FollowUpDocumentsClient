import { requirePageAuth } from "@/lib/auth";
import { getQuickAddData } from "@/lib/store";
import { QuickAddProvider } from "@/components/quick-add";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAuth();
  const quickAdd = await getQuickAddData();

  return (
    <ToastProvider>
      <QuickAddProvider
        cases={quickAdd.cases}
        templates={quickAdd.templates}
        settings={quickAdd.settings}
      >
        <div className="app-frame">
          <Sidebar />
          <div className="app-main">
            <TopBar />
            <main>{children}</main>
          </div>
        </div>
      </QuickAddProvider>
    </ToastProvider>
  );
}

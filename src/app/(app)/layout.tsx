import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { GlobalSearch, MobileNav, Sidebar } from "@/components/nav";
import { buttonClass } from "@/components/ui";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? ""} signOut={signOut} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <span className="text-sm font-semibold lg:hidden">Hotel Ops</span>
            <GlobalSearch />
            <Link href="/hotels/new" className={buttonClass("primary", "md", "ml-auto")}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add hotel</span>
            </Link>
          </div>
          <MobileNav />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

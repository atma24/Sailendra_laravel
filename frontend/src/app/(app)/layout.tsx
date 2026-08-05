"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, clearSession, isMultiRole } from "@/lib/auth";

const MENUS: { title: string; url: string; icon: string }[] = [
  { title: "Dashboard", url: "/dashboard", icon: "bi-buildings-fill" },
  { title: "Master Data", url: "/master-data", icon: "bi-folder2-open" },
  { title: "Inbound", url: "/inbound", icon: "bi-box-arrow-in-down" },
  { title: "Outbound", url: "/outbound", icon: "bi-box-arrow-up" },
  { title: "Traceability", url: "/traceability", icon: "bi-arrow-repeat" },
  { title: "Mutasi", url: "/mutasi", icon: "bi-arrow-left-right" },
  { title: "Stock", url: "/stock", icon: "bi-box-seam" },
  { title: "Stock Opname", url: "/stock-opname", icon: "bi-clipboard-check" },
  { title: "Report", url: "/report", icon: "bi-file-earmark-text" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (isMultiRole(s.user.role) && !s.lokasi) {
      router.replace("/pilih-lokasi");
      return;
    }
    setUser(s.user);
  }, [router]);

  if (!user) return null;

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const pageTitle = (() => {
    const m = MENUS.find((x) => pathname.startsWith(x.url) && x.url !== "/dashboard");
    return m ? m.title : "Dashboard";
  })();

  return (
    <div className="flex h-screen w-full">
      <div
        className={`fixed inset-y-0 left-0 z-[1040] flex h-full w-[188px] flex-col border-r border-[#e7eaf2] bg-white px-[10px] py-3 transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-1.5 flex items-center justify-center border-b border-[#e7eaf2] pb-3.5 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sailendra.png" alt="Sailendra" className="h-14 w-14 object-contain" />
        </div>

        <nav className="flex-1 pt-2.5">
          {MENUS.map((m) => {
            const active = pathname === m.url || (m.url !== "/dashboard" && pathname.startsWith(m.url));
            return (
              <a
                key={m.url}
                href={m.url}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(m.url);
                  setSidebarOpen(false);
                }}
                className={`mb-1 flex w-full items-center gap-2 rounded-[11px] px-2.5 py-2 text-left text-[12px] font-bold no-underline transition hover:translate-x-[3px] ${active ? "bg-[#eef0ff] text-[#191970]" : "bg-transparent text-[#172033]"}`}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center text-[15px]">
                  {/* bootstrap-icons-style glyphs */}
                  <i className={`bi ${m.icon}`} />
                </span>
                <span className="min-w-0 flex-1">{m.title}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#e7eaf2] pt-4">
          <button
            onClick={logout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[rgba(239,43,45,0.09)] py-2.5 text-[13px] font-extrabold text-[#ef2b2d] transition hover:-translate-y-px hover:bg-[#ef2b2d] hover:text-white hover:shadow-[0_14px_28px_rgba(239,43,45,0.22)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 17l5-5-5-5v3H3v4h7v3zM18 3H8a2 2 0 0 0-2 2v4h2V5h10v14H8v-4H6v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[1030] bg-[rgba(15,23,42,0.4)] backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="h-screen flex-1 overflow-y-auto p-[13px_15px]">
        <div className="w-full max-w-full">
          <div className="mb-2.5 flex min-h-[50px] items-center justify-between rounded-[14px] border border-[#e7eaf2] bg-white px-3.5 py-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="cursor-pointer p-0 text-[26px] text-[#191970] lg:hidden"
                aria-label="Menu"
              >
                ☰
              </button>
              <div>
                <h1 className="m-0 text-lg font-extrabold tracking-tight text-[#191970]">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[12px] font-extrabold">{user.username}</div>
                <div className="text-[11px] font-semibold text-[#6b7280]">{user.role}</div>
              </div>
              <div className="flex h-[31px] w-[31px] items-center justify-center rounded-xl bg-[#eef0ff] text-sm font-extrabold text-[#191970]">
                {(user.username || "U").charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
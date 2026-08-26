"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { apiGet } from "@/lib/api";
import { clearSession, getSession, isMultiRole, type Session } from "@/lib/auth";
import "../app-shell.css";

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
  if (pathname === "/profile") return "Profile";
  const base = pathname.split("/").pop() || "";
  const map: Record<string, string> = {
    "layout-gudang": "Layout Gudang",
    "form-layout-gudang": "Form Layout Gudang",
    "history-layout-gudang": "History Layout Gudang",
    produk: "List Produk",
    plant: "List Plant",
  };
  if (map[base]) return map[base];
  return base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [auth, setAuth] = useState<{ loaded: boolean; session: Session | null }>({
    loaded: false,
    session: null,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate so SSR & initial client render both render nothing (deterministic), avoiding hydration mismatch from localStorage auth
    setAuth({ loaded: true, session: getSession() });
    const saved = localStorage.getItem("sailendra_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!auth.loaded) return;
    if (!auth.session) {
      router.replace("/login");
      return;
    }
    apiGet("/me").then(
      () => {
        if (
          isMultiRole(auth.session!.user.role) &&
          Array.isArray(auth.session!.lokasi) &&
          auth.session!.lokasi.length === 0
        ) {
          router.replace("/pilih-lokasi");
        }
      },
      () => {
        clearSession();
        router.replace("/login");
      }
    );
  }, [router, auth]);

  if (!auth.loaded || !auth.session) return null;

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sailendra_sidebar_collapsed", String(next));
      return next;
    });
  }

  function logout() {
    clearSession();
    setSidebarOpen(false);
    router.replace("/login");
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        session={auth.session}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      <main className="main-content">
        <div className="page-wrap">
          <div className="topbar-card">
            <div className="topbar-left">
              <button
                type="button"
                className="burger-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Buka menu"
              >
                <i className="bi bi-list"></i>
              </button>
              <h1 className="page-title">{pageTitleFromPath(pathname)}</h1>
            </div>

            <Link href="/profile" className="user-box">
              <div>
                <div className="user-name">{auth.session.user.username}</div>
                <div className="user-role">{auth.session.user.role}</div>
              </div>
              <div className="user-avatar">
                {auth.session.user.username.slice(0, 1).toUpperCase()}
              </div>
            </Link>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { menusForRole, type MenuItem } from "@/lib/menus";
import type { Session } from "@/lib/auth";

function isChildOpen(item: MenuItem, pathname: string) {
  return !!item.children?.some((c) => pathname.startsWith(c.path));
}

export default function Sidebar({
  session,
  onLogout,
  open = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  session: Session;
  onLogout: () => void;
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const menus = menusForRole(session.user.role);
  const [openParent, setOpenParent] = useState<string | null>(
    menus.find((m) => isChildOpen(m, pathname))?.title ?? null
  );
  // Saat sheet mobile terbuka, paksa mode expanded agar teks menu/logout
  // selalu tampil walau user mengaktifkan collapse di desktop.
  const effectiveCollapsed = collapsed && !open;

  return (
    <aside
      className={`sidebar ${open ? "show" : ""} ${collapsed ? "collapsed" : ""}`}
      id="mobile-menu-sheet"
      role={open ? "dialog" : undefined}
      aria-modal={open ? true : undefined}
      aria-label="Menu navigasi"
    >
      <div className="sheet-handle" aria-hidden="true">
        <span />
      </div>
      <div className="brand-area">
          <button
            type="button"
            className="brand-logo-btn"
            onClick={() => {
              if (onToggleCollapse && !open) {
                onToggleCollapse();
              }
            }}
            title={effectiveCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
          >
          <div className="brand-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logosailendra.png" alt="Logo Sailendra" />
          </div>
          {!effectiveCollapsed && <span className="brand-name">Sailendra</span>}
        </button>
        {onClose && (
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <Link
          href="/dashboard"
          onClick={onClose}
          className={`nav-link-custom ${pathname === "/dashboard" || pathname === "/" ? "active" : ""}`}
          title={effectiveCollapsed ? "Dashboard" : undefined}
        >
          <i className="bi bi-buildings-fill nav-icon"></i>
          {!effectiveCollapsed && <span className="nav-text">Dashboard</span>}
        </Link>

        {menus.map((m) => {
          if (m.children?.length) {
            const parentOpen = openParent === m.title;
            return (
              <div key={m.title}>
                <button
                  type="button"
                  className={`nav-button-custom ${parentOpen ? "open" : ""}`}
                  onClick={() => setOpenParent(parentOpen ? null : m.title)}
                  title={effectiveCollapsed ? m.title : undefined}
                  aria-expanded={parentOpen}
                >
                  <i className={`${m.icon} nav-icon`}></i>
                  {!effectiveCollapsed && <span className="nav-text">{m.title}</span>}
                  {!effectiveCollapsed && <i className="bi bi-chevron-down chevron"></i>}
                </button>

                <div className={`submenu-wrap ${parentOpen ? "show" : ""}`}>
                  {m.children.map((c) => (
                    <Link
                      key={c.path}
                      href={c.path}
                      onClick={onClose}
                      className={`submenu-link ${pathname.startsWith(c.path) ? "active" : ""}`}
                      title={effectiveCollapsed ? c.title : undefined}
                    >
                      {!effectiveCollapsed && <span>{c.title}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <Link
              key={m.title}
              href={m.path!}
              onClick={onClose}
              className={`nav-link-custom ${pathname === m.path || pathname.startsWith(m.path + "/") ? "active" : ""}`}
              title={effectiveCollapsed ? m.title : undefined}
            >
              <i className={`${m.icon} nav-icon`}></i>
              {!effectiveCollapsed && <span className="nav-text">{m.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="logout-btn" onClick={onLogout} title="Keluar dari Aplikasi">
          <i className="bi bi-box-arrow-right"></i>
          {!effectiveCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
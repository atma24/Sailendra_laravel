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

  return (
    <aside className={`sidebar ${open ? "show" : ""} ${collapsed ? "collapsed" : ""}`}>
      <div className="brand-area">
          <button
            type="button"
            className="brand-logo-btn"
            onClick={() => {
              if (onToggleCollapse && !open) {
                onToggleCollapse();
              }
            }}
            title={collapsed ? "Perluas Sidebar" : "Kecilkan Sidebar"}
          >
          <div className="brand-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logosailendra.png" alt="Logo Sailendra" />
          </div>
          {!collapsed && <span className="brand-name">Sailendra</span>}
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
          title={collapsed ? "Dashboard" : undefined}
        >
          <i className="bi bi-buildings-fill nav-icon"></i>
          {!collapsed && <span className="nav-text">Dashboard</span>}
        </Link>

        {menus.map((m) => {
          if (m.children?.length) {
            const open = openParent === m.title;
            return (
              <div key={m.title}>
                <button
                  type="button"
                  className={`nav-button-custom ${open ? "open" : ""}`}
                  onClick={() => setOpenParent(open ? null : m.title)}
                  title={collapsed ? m.title : undefined}
                >
                  <i className={`${m.icon} nav-icon`}></i>
                  {!collapsed && <span className="nav-text">{m.title}</span>}
                  {!collapsed && <i className="bi bi-chevron-down chevron"></i>}
                </button>

                <div className={`submenu-wrap ${open ? "show" : ""}`}>
                  {m.children.map((c) => (
                    <Link
                      key={c.path}
                      href={c.path}
                      onClick={onClose}
                      className={`submenu-link ${pathname.startsWith(c.path) ? "active" : ""}`}
                      title={collapsed ? c.title : undefined}
                    >
                      {!collapsed && <span>{c.title}</span>}
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
              title={collapsed ? m.title : undefined}
            >
              <i className={`${m.icon} nav-icon`}></i>
              {!collapsed && <span className="nav-text">{m.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="logout-btn" onClick={onLogout} title="Keluar dari Aplikasi">
          <i className="bi bi-box-arrow-right"></i>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
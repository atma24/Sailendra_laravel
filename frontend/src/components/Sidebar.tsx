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
}: {
  session: Session;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const menus = menusForRole(session.user.role);
  const [openParent, setOpenParent] = useState<string | null>(
    menus.find((m) => isChildOpen(m, pathname))?.title ?? null
  );

  return (
    <aside className="sidebar">
      <div className="brand-area">
        <div className="brand-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logosailendra.png" alt="Logo Sailendra" />
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link
          href="/dashboard"
          className={`nav-link-custom ${pathname === "/dashboard" || pathname === "/" ? "active" : ""}`}
        >
          <i className="bi bi-buildings-fill nav-icon"></i>
          <span className="nav-text">Dashboard</span>
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
                >
                  <i className={`${m.icon} nav-icon`}></i>
                  <span className="nav-text">{m.title}</span>
                  <i className="bi bi-chevron-down chevron"></i>
                </button>

                <div className={`submenu-wrap ${open ? "show" : ""}`}>
                  {m.children.map((c) => (
                    <Link
                      key={c.path}
                      href={c.path}
                      className={`submenu-link ${pathname.startsWith(c.path) ? "active" : ""}`}
                    >
                      {c.title}
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
              className={`nav-link-custom ${pathname === m.path || pathname.startsWith(m.path + "/") ? "active" : ""}`}
            >
              <i className={`${m.icon} nav-icon`}></i>
              <span className="nav-text">{m.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="logout-btn" onClick={onLogout}>
          <i className="bi bi-box-arrow-right"></i>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
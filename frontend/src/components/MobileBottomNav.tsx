"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileBottomNav({
  menuOpen = false,
  onMenu,
  onLogout,
}: {
  menuOpen?: boolean;
  onMenu: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/dashboard" || pathname === "/";
  const isProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <nav className="bottom-nav" aria-label="Navigasi bawah">
      <Link
        href="/dashboard"
        className={`bottom-nav-item ${isHome ? "active" : ""}`}
        aria-current={isHome ? "page" : undefined}
      >
        <i className="bi bi-house-door-fill"></i>
        <span>Home</span>
      </Link>

      <button
        type="button"
        className={`bottom-nav-item ${menuOpen ? "active" : ""}`}
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-controls="mobile-menu-sheet"
        aria-label="Buka menu navigasi"
      >
        <i className="bi bi-grid-fill"></i>
        <span>Menu</span>
      </button>

      <Link
        href="/profile"
        className={`bottom-nav-item ${isProfile ? "active" : ""}`}
        aria-current={isProfile ? "page" : undefined}
      >
        <i className="bi bi-person-fill"></i>
        <span>Profil</span>
      </Link>

      <button
        type="button"
        className="bottom-nav-item bottom-nav-logout"
        onClick={onLogout}
        aria-label="Keluar dari aplikasi"
        title="Keluar dari aplikasi"
      >
        <i className="bi bi-box-arrow-right"></i>
        <span>Keluar</span>
      </button>
    </nav>
  );
}

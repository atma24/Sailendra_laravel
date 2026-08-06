import { useSyncExternalStore } from "react";

export type AkunLokasi = {
  id_pengguna: number;
  id_pengguna_lokasi: number | null;
  username: string;
  role: string;
  status: string;
  created_at: string;
  nama_pengguna_lokasi: string | null;
  akun_lokasi?: AkunLokasi[];
  perlu_pilih_lokasi?: boolean;
  token?: string;
};

export type Session = {
  user: AkunLokasi;
  token: string;
  lokasi: (number | string)[] | "all";
};

const KEY = "sailendra_session";

let cached: Session | null = null;
let cachedRaw: string | null = null;

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    try {
      cached = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cached = null;
    }
    cachedRaw = raw;
  }
  return cached;
}

// Reads the persisted session on the client only. On the server it always
// returns null, then re-hydrates on the client — avoids a hydration mismatch
// from touching localStorage during SSR.
export function useSession() {
  return useSyncExternalStore(noopSubscribe, readSession, readSession);
}

const noopSubscribe = () => () => {};

export function getSession(): Session | null {
  return readSession();
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function isMultiRole(role: string) {
  const r = (role || "").trim().toLowerCase();
  return r === "support" || r === "superadmin";
}

export const SUPERVISOR_ROLES = ["Supervisor", "SuperAdmin"];
export const MASTER_DATA_ROLES = ["Supervisor", "Support", "SuperAdmin"];

// Parameter lokasi untuk panggilan API.
export function lokasiParam(s: Session): string {
  const role = s.user.role || "";
  if (isMultiRole(role) && s.lokasi === "all") return "";
  if (isMultiRole(role) && Array.isArray(s.lokasi) && s.lokasi.length > 0) {
    return `id_pengguna_lokasi_multi=${s.lokasi.join(",")}`;
  }
  if (s.user.id_pengguna_lokasi) {
    return `id_pengguna_lokasi=${s.user.id_pengguna_lokasi}`;
  }
  return "";
}

export function aktifLokasiId(s: Session): string {
  if (isMultiRole(s.user.role) && Array.isArray(s.lokasi) && s.lokasi.length > 0) {
    return String(s.lokasi[0]);
  }
  return String(s.user.id_pengguna_lokasi || "");
}
export type AkunLokasi = {
  id_pengguna: number;
  id_pengguna_lokasi: number | null;
  username: string;
  role: string;
  status: string;
  created_at: string;
  nama_pengguna_lokasi: string | null;
  akun_lokasi?: any[];
};

export type Session = {
  user: AkunLokasi;
  lokasi: (number | string)[] | "all"; // pilihan lokasi aktif (Support/SuperAdmin bisa multi/all)
};

const KEY = "sailendra_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
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

// Parameter lokasi untuk panggilan API dashboard/mutasi dll.
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
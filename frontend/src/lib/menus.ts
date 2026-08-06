export type MenuChild = { title: string; path: string; page: string };
export type MenuItem = {
  title: string;
  icon: string;
  path?: string;
  page?: string;
  children?: MenuChild[];
};

const layout = (page: string) => `/masterdata/${page}`;

const masterData = {
  title: "Master Data",
  icon: "bi-folder2-open",
  children: [
    { title: "Layout Gudang", path: layout("layout-gudang"), page: "layout_gudang" },
    { title: "Form Layout Gudang", path: layout("form-layout-gudang"), page: "form_layout_gudang" },
    { title: "History Layout Gudang", path: layout("history-layout-gudang"), page: "history_layout_gudang" },
    { title: "List Produk", path: layout("produk"), page: "produk" },
    { title: "List Plant", path: layout("plant"), page: "plant" },
  ],
};

const singles = [
  { title: "Inbound", icon: "bi-box-arrow-in-down", path: "/inbound", page: "inbound" },
  { title: "Outbound", icon: "bi-box-arrow-up", path: "/outbound", page: "outbound" },
  { title: "Traceability", icon: "bi-arrow-repeat", path: "/traceability", page: "traceability" },
  { title: "Mutasi", icon: "bi-arrow-left-right", path: "/mutasi", page: "mutasi" },
  { title: "Stock", icon: "bi-box-seam", path: "/stock", page: "stock" },
  { title: "Stock Opname", icon: "bi-clipboard-check", path: "/stock-opname", page: "stock_opname" },
  { title: "Report", icon: "bi-file-earmark-text", path: "/report", page: "report" },
];

const layoutGudang = {
  title: "Layout Gudang",
  icon: "bi-building",
  path: layout("layout-gudang"),
  page: "layout_gudang",
};

// Matches CI3 get_menus_by_role matrix in Dashboard.php.
export const MENUS: Record<string, MenuItem[]> = {
  Supervisor: [
    { ...masterData },
    singles[0],
    singles[1],
    singles[2],
    singles[3],
    singles[4],
    singles[5],
    singles[6],
  ],
  Checker: [singles[0], singles[1], { ...layoutGudang }, singles[4], singles[5]],
  Support: [
    {
      ...masterData,
      children: masterData.children!.filter((c) => c.page !== "form_layout_gudang"),
    },
    singles[0],
    singles[1],
    singles[4],
    singles[6],
  ],
  Forklift: [singles[0], singles[1], { ...layoutGudang }, singles[4]],
  SuperAdmin: [
    { ...masterData },
    singles[0],
    singles[1],
    singles[2],
    singles[3],
    singles[4],
    singles[5],
    singles[6],
  ],
};

export function menusForRole(role: string): MenuItem[] {
  return MENUS[role] || [];
}
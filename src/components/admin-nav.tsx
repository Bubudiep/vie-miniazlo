import { useLocation, useNavigate } from "react-router-dom";

const links = [
  { path: "/admin", label: "Dashboard" },
  { path: "/admin/products", label: "Mặt hàng" },
  { path: "/admin/inventory", label: "Kho" },
  { path: "/admin/reports", label: "Báo cáo" },
  { path: "/admin/staff", label: "Nhân viên" },
  { path: "/admin/settings", label: "Cài đặt" },
];

export default function AdminNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return <nav aria-label="Quản trị" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 sm:justify-center">
    {links.map((link) => {
      const active = link.path === "/admin" ? pathname === link.path : pathname === link.path || pathname.startsWith(`${link.path}/`);
      return <button key={link.path} type="button" aria-current={active ? "page" : undefined} onClick={() => navigate(link.path)} className={`min-h-10 shrink-0 rounded-md px-3 text-sm font-semibold ${active ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        {link.label}
      </button>;
    })}
  </nav>;
}

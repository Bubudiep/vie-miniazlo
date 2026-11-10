import { Icon, Page, Text } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";

import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";

const sections = [
  { title: "Vận hành", items: [["Sơ đồ bàn", "/", "zi-list-1"], ["Mặt hàng", "/admin/products", "zi-list-1"], ["Kho hàng", "/admin/inventory", "zi-inbox"], ["Thiết lập kho", "/admin/inventory/settings", "zi-setting"], ["Lịch sử bill", "/admin/bill-history", "zi-clock-1"], ["Báo cáo doanh thu", "/admin/reports", "zi-list-1"]] },
  { title: "Khách hàng và nhân sự", items: [["Duyệt tài khoản", "/admin/registration", "zi-check-circle"], ["Nhân viên", "/admin/staff", "zi-user"], ["Nhóm khách và thẻ thành viên", "/admin/customer-segments", "zi-list-1"], ["Khuyến mại", "/admin/promotions", "zi-list-1"]] },
  { title: "Tài chính và chương trình", items: [["Tài khoản nhận tiền QR", "/account", "zi-list-1"], ["Quản lý ví", "/admin/wallets", "zi-list-1"], ["Theo dõi nạp tiền", "/admin/wallet-topups", "zi-check-circle"], ["Quản lý Xu", "/admin/xu", "zi-list-1"]] },
] as const;

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-4">
      <header><Text.Title size="small" className="text-slate-900">Cài đặt quản trị</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Truy cập các thiết lập và công cụ của cửa hàng</Text></header>
      {sections.map((section) => <section key={section.title} className="space-y-2"><Text size="small" className="font-semibold text-slate-600">{section.title}</Text><div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">{section.items.map(([label, path, icon]) => <button key={path} type="button" onClick={() => navigate(path)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Icon icon={icon} /></span><Text size="small" className="min-w-0 flex-1 font-medium text-slate-800">{label}</Text><Icon icon="zi-chevron-right" className="text-slate-400" /></button>)}</div></section>)}
    </main>
  </Page>;
}

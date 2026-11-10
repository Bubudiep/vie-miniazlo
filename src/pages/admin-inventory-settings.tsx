import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";

import { inventoryService } from "@/api/services";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";

const messageOf = (error: any) => error?.response?.message || error?.response?.data?.error || error?.message || "Không thể lưu thiết lập kho";

export default function AdminInventorySettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const openSnackbarRef = useRef(openSnackbar);
  openSnackbarRef.current = openSnackbar;
  const [inventoryRequired, setInventoryRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await inventoryService.getSettings();
      setInventoryRequired(settings.inventoryRequired);
    } catch (error) {
      openSnackbarRef.current({ text: messageOf(error), type: "error", position: "top" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/", { replace: true }); return; }
    void load();
  }, [user?.role, navigate, load]);

  const save = async () => {
    setSaving(true);
    try {
      const settings = await inventoryService.saveSettings(inventoryRequired);
      setInventoryRequired(settings.inventoryRequired);
      openSnackbar({ text: settings.inventoryRequired ? "Đã bật yêu cầu tồn kho" : "Đã tắt yêu cầu tồn kho", type: "success", position: "top" });
    } catch (error) {
      openSnackbar({ text: messageOf(error), type: "error", position: "top" });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-4">
      <header className="flex items-center gap-3"><button type="button" aria-label="Quay lại kho hàng" title="Quay lại kho hàng" onClick={() => navigate("/admin/inventory")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"><Icon icon="zi-chevron-left" /></button><div><Text.Title size="small" className="text-slate-900">Thiết lập kho</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Áp dụng riêng cho cửa hàng hiện tại</Text></div></header>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><Text size="small" className="font-semibold text-slate-900">Yêu cầu tồn kho khi bán hàng</Text><Text size="xSmall" className="mt-1 block leading-5 text-slate-500">Khi tắt, có thể bán không giới hạn tồn kho; số lượng xuất vẫn được ghi nhận và tồn có thể âm. Lợi nhuận vẫn tính theo giá nhập đã lưu của mặt hàng.</Text></div><label className="relative mt-0.5 inline-flex h-8 w-14 shrink-0 cursor-pointer items-center"><input type="checkbox" checked={inventoryRequired} onChange={(event) => setInventoryRequired(event.target.checked)} className="peer sr-only" /><span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600 peer-focus-visible:ring-offset-2" /><span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" /></label></div>
        {!inventoryRequired && <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Cửa hàng đang cho phép bán vượt tồn kho.</div>}
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Spinner />}Lưu thiết lập</button>
      </section>}
    </main>
  </Page>;
}

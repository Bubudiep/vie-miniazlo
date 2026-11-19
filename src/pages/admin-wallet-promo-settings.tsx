import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";
import { walletService } from "@/api/services";
import type { WalletPromoSettings, WalletPromoTier } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";

const emptySettings: WalletPromoSettings = { tiers: [], maxPromoBalance: 0, expiryMode: "days", expiryDate: "" };
const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;
const blankTier = (): WalletPromoTier => ({ minTopup: 100000, type: "fixed", value: 10000 });

export default function AdminWalletPromoSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const openSnackbarRef = useRef(openSnackbar);
  openSnackbarRef.current = openSnackbar;
  const [settings, setSettings] = useState<WalletPromoSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setSettings(await walletService.getPromoSettings()); }
    catch (error: any) { openSnackbarRef.current({ text: error?.response?.data?.error || "Không thể tải thiết lập thưởng nạp", type: "error", position: "top" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === "admin") void load(); }, [user?.role, load]);
  if (user?.role !== "admin") return <Navigate to="/" replace />;

  const updateTier = (index: number, changes: Partial<WalletPromoTier>) => setSettings((current) => ({ ...current, tiers: current.tiers.map((tier, i) => i === index ? { ...tier, ...changes } : tier) }));
  const save = async () => {
    const thresholds = settings.tiers.map((tier) => tier.minTopup);
    if (!Number.isSafeInteger(settings.maxPromoBalance) || settings.maxPromoBalance < 0 || settings.tiers.length > 50 || settings.tiers.some((tier) => !Number.isSafeInteger(tier.minTopup) || tier.minTopup <= 0 || !Number.isFinite(tier.value) || tier.value <= 0 || (tier.type === "fixed" && !Number.isSafeInteger(tier.value)) || (tier.type === "percent" && tier.value > 100)) || new Set(thresholds).size !== thresholds.length || (settings.expiryMode === "date" && !settings.expiryDate)) {
      openSnackbar({ text: "Kiểm tra các mốc nạp, tiền thưởng, mức trần và hạn dùng", type: "warning", position: "top" }); return;
    }
    setSaving(true);
    try {
      setSettings(await walletService.savePromoSettings(settings));
      openSnackbar({ text: "Đã lưu thiết lập thưởng nạp", type: "success", position: "top" });
    } catch (error: any) { openSnackbar({ text: error?.response?.data?.error || "Không thể lưu thiết lập", type: "error", position: "top" }); }
    finally { setSaving(false); }
  };

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader /><AdminNav />
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-4">
      <header className="flex items-center gap-3"><button type="button" aria-label="Quay lại" onClick={() => navigate("/admin/settings")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white"><Icon icon="zi-chevron-left" /></button><div><Text.Title size="small">Thưởng nạp ví khuyến mãi</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Thiết lập riêng cho cửa hàng hiện tại</Text></div></header>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : <>
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3"><Text size="small" className="font-semibold text-slate-900">Mốc thưởng nạp</Text><button type="button" onClick={() => setSettings((current) => ({ ...current, tiers: [...current.tiers, blankTier()] }))} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700">+ Thêm mốc</button></div>
          {settings.tiers.length === 0 && <Text size="small" className="text-slate-500">Chưa có mốc thưởng. Nạp tiền sẽ không được cộng khuyến mãi.</Text>}
          {settings.tiers.map((tier, index) => <div key={index} className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_1fr_1fr_2.5rem] sm:items-end">
            <label className="block text-xs text-slate-600">Nạp tối thiểu<input type="number" min="1" step="1000" inputMode="numeric" value={tier.minTopup} onChange={(event) => updateTier(index, { minTopup: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
            <label className="block text-xs text-slate-600">Kiểu thưởng<select value={tier.type} onChange={(event) => updateTier(index, { type: event.target.value as WalletPromoTier["type"] })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-2 text-sm"><option value="fixed">Số tiền cố định</option><option value="percent">Theo phần trăm</option></select></label>
            <label className="block text-xs text-slate-600">{tier.type === "fixed" ? "Tiền thưởng (đ)" : "Tỷ lệ (%)"}<input type="number" min="0.01" max={tier.type === "percent" ? 100 : undefined} step={tier.type === "percent" ? 0.1 : 1000} inputMode="decimal" value={tier.value} onChange={(event) => updateTier(index, { value: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
            <button type="button" aria-label={`Xóa mốc ${index + 1}`} onClick={() => setSettings((current) => ({ ...current, tiers: current.tiers.filter((_, i) => i !== index) }))} className="flex h-10 w-10 items-center justify-center text-red-600"><Icon icon="zi-delete" /></button>
          </div>)}
          <Text size="xSmall" className="block leading-5 text-slate-500">Một lần nạp chỉ áp dụng mốc cao nhất đạt được. Mốc phần trăm tính trên số tiền nạp; mỗi mốc nạp phải khác nhau.</Text>
        </section>
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-800">Số dư khuyến mãi tối đa<input type="number" min="0" step="1000" inputMode="numeric" value={settings.maxPromoBalance} onChange={(event) => setSettings((current) => ({ ...current, maxPromoBalance: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3" /><span className="mt-1 block text-xs text-slate-500">Nhập 0 để không giới hạn. Chỉ tiền thưởng tự động bị giới hạn; admin vẫn có thể điều chỉnh số dư.</span></label>
          <label className="block text-sm font-medium text-slate-800">Thời hạn thưởng<select value={settings.expiryMode} onChange={(event) => setSettings((current) => ({ ...current, expiryMode: event.target.value as WalletPromoSettings["expiryMode"] }))} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="days">3 ngày kể từ lúc xác nhận nạp</option><option value="date">Đến ngày cụ thể</option></select></label>
          {settings.expiryMode === "date" && <label className="block text-sm font-medium text-slate-800">Ngày hết hạn<input type="date" value={settings.expiryDate} onChange={(event) => setSettings((current) => ({ ...current, expiryDate: event.target.value }))} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3" /><span className="mt-1 block text-xs text-slate-500">Thưởng có hiệu lực đến hết ngày đã chọn theo giờ Việt Nam.</span></label>}
          <button type="button" disabled={saving} onClick={() => void save()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Spinner />}Lưu thiết lập</button>
        </section>
      </>}
    </main>
  </Page>;
}

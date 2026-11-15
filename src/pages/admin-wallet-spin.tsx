import { useCallback, useEffect, useState } from "react";
import { Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";
import { walletService } from "@/api/services";
import type { WalletSpinPrize } from "@/api/services";
import type { WalletUser } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";

const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;
const blankPrize = (): WalletSpinPrize => ({ name: "", amount: 0, probability: 0 });

export default function AdminWalletSpinPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [minTopup, setMinTopup] = useState("100000");
  const [prizes, setPrizes] = useState<WalletSpinPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<WalletUser | null>(null);
  const [activating, setActivating] = useState(false);
  const load = useCallback(async () => {
    try {
      const settings = await walletService.getSpinSettings();
      setMinTopup(String(settings.minTopup || ""));
      setPrizes(settings.prizes);
    } catch (error: any) {
      openSnackbar({ text: error?.response?.data?.error || "Không thể tải cấu hình quay số", type: "error", position: "top" });
    } finally { setLoading(false); }
  }, [openSnackbar]);
  useEffect(() => { if (user?.role === "admin") void load(); }, [user?.role, load]);
  const searchUsers = async () => {
    try { setUsers(await walletService.listUsers(query)); }
    catch { openSnackbar({ text: "Không thể tìm user", type: "error", position: "top" }); }
  };
  const activate = async () => {
    if (!selectedUser) return;
    setActivating(true);
    try { const result = await walletService.activateSpin(selectedUser.id); openSnackbar({ text: result.alreadyActive ? "User đang có lượt quay chờ thao tác" : "Đã bật lượt quay cho user", type: "success", position: "top" }); }
    catch (error: any) { openSnackbar({ text: error?.response?.data?.error || "Không thể bật lượt quay", type: "error", position: "top" }); }
    finally { setActivating(false); }
  };
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  const updatePrize = (index: number, field: keyof WalletSpinPrize, value: string) => setPrizes((items) => items.map((item, i) => i === index ? { ...item, [field]: field === "name" ? value : Number(value) } : item));
  const totalProbability = prizes.reduce((sum, prize) => sum + (Number(prize.probability) || 0), 0);
  const save = async () => {
    if (!Number.isSafeInteger(Number(minTopup)) || Number(minTopup) < 0 || totalProbability > 100 || prizes.some((p) => !p.name.trim() || !Number.isSafeInteger(Number(p.amount)) || p.amount < 0 || p.probability < 0 || p.probability > 100)) {
      openSnackbar({ text: "Kiểm tra ngưỡng nạp và thông tin phần thưởng; tổng tỷ lệ không quá 100%", type: "warning", position: "top" }); return;
    }
    setSaving(true);
    try {
      const saved = await walletService.saveSpinSettings({ minTopup: Number(minTopup), prizes });
      setMinTopup(String(saved.minTopup)); setPrizes(saved.prizes);
      openSnackbar({ text: "Đã lưu chương trình quay số", type: "success", position: "top" });
    } catch (error: any) { openSnackbar({ text: error?.response?.data?.error || "Không thể lưu cấu hình", type: "error", position: "top" }); }
    finally { setSaving(false); }
  };
  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader /><AdminNav />
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-4">
      <header className="flex items-center gap-3"><button type="button" aria-label="Quay lại" onClick={() => navigate("/admin/settings")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white"><Icon icon="zi-chevron-left" /></button><div><Text.Title size="small">Quay số nạp tiền</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Cấu hình áp dụng riêng cho cửa hàng</Text></div></header>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : <>
        <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div><Text size="small" className="font-semibold text-amber-900">Bật quay số cho user</Text><Text size="xSmall" className="mt-1 block text-amber-800">Tìm user, chọn một người rồi bật lượt quay. User sẽ thấy bảng quay ngay trên thiết bị.</Text></div>
          <div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchUsers(); }} placeholder="Tên đăng nhập hoặc email" className="min-h-10 min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 text-sm" /><button type="button" onClick={() => void searchUsers()} className="min-h-10 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white">Tìm</button></div>
          {users.length > 0 && <div className="space-y-2">{users.map((item) => <button type="button" key={item.id} onClick={() => setSelectedUser(item)} className={`w-full rounded-lg border bg-white p-3 text-left ${selectedUser?.id === item.id ? "border-amber-500" : "border-transparent"}`}><Text size="small" className="font-semibold">{item.username}</Text><Text size="xSmall" className="block text-slate-500">{item.email || "Chưa có email"}</Text></button>)}</div>}
          {selectedUser && <button type="button" disabled={activating} onClick={() => void activate()} className="min-h-11 w-full rounded-lg bg-amber-600 text-sm font-semibold text-white disabled:opacity-60">{activating ? "Đang bật..." : `Bật quay cho ${selectedUser.username}`}</button>}
        </section>
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-800">Số tiền nạp tối thiểu để được quay<input type="number" min="0" step="1000" inputMode="numeric" value={minTopup} onChange={(event) => setMinTopup(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3" /><span className="mt-1 block text-xs text-slate-500">Nhập 0 để tắt chương trình.</span></label>
          <div className="flex items-center justify-between"><Text size="small" className="font-semibold">Danh sách phần thưởng</Text><Text size="xSmall" className={totalProbability > 100 ? "text-red-600" : "text-slate-500"}>Tổng tỷ lệ: {totalProbability}%</Text></div>
          {prizes.map((prize, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,0.7fr)_5rem_2.5rem] items-end gap-2 border-t border-slate-100 pt-3">
            <label className="min-w-0 text-xs text-slate-600">Tên giải<input value={prize.name} onChange={(e) => updatePrize(index, "name", e.target.value)} maxLength={120} className="mt-1 min-h-10 w-full rounded-md border px-2 text-sm" /></label>
            <label className="min-w-0 text-xs text-slate-600">Tiền thưởng<input type="number" min="0" step="1000" value={prize.amount} onChange={(e) => updatePrize(index, "amount", e.target.value)} className="mt-1 min-h-10 w-full rounded-md border px-2 text-sm" /></label>
            <label className="text-xs text-slate-600">Tỷ lệ %<input type="number" min="0" max="100" step="0.1" value={prize.probability} onChange={(e) => updatePrize(index, "probability", e.target.value)} className="mt-1 min-h-10 w-full rounded-md border px-2 text-sm" /></label>
            <button type="button" aria-label={`Xóa ${prize.name || "phần thưởng"}`} onClick={() => setPrizes((items) => items.filter((_, i) => i !== index))} className="flex h-10 w-10 items-center justify-center rounded-md text-red-600"><Icon icon="zi-delete" /></button>
          </div>)}
          <button type="button" onClick={() => setPrizes((items) => [...items, blankPrize()])} className="min-h-10 w-full rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-700">+ Thêm phần thưởng</button>
          <Text size="xSmall" className="block leading-5 text-slate-500">Mỗi giải cộng tiền vào tài khoản chính. Phần tỷ lệ còn lại là lượt không trúng; tổng xác suất không được vượt quá 100%.</Text>
          <button type="button" disabled={saving} onClick={() => void save()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Spinner />}Lưu cấu hình</button>
        </section>
        {prizes.length > 0 && <section className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-4"><Text size="small" className="py-3 font-semibold">Tổng tiền thưởng theo giải</Text>{prizes.map((prize, i) => <div key={i} className="flex justify-between gap-3 py-3 text-sm"><span>{prize.name || "Chưa đặt tên"} · {prize.probability}%</span><strong>{money(prize.amount)}</strong></div>)}</section>}
      </>}
    </main>
  </Page>;
}

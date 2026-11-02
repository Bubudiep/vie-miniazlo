import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { adminDashboardService } from "@/api/services";
import type { AdminDashboardReport } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoneyInput, handleMoneyInput } from "@/utils/format";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;
const messageOf = (error: any) => error?.response?.message || error?.response?.data?.error || error?.message || "Không thể tải Dashboard";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const openSnackbarRef = useRef(openSnackbar);
  openSnackbarRef.current = openSnackbar;
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<AdminDashboardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [spentAt, setSpentAt] = useState(today());

  const load = useCallback(async () => {
    setLoading(true);
    try { setReport(await adminDashboardService.get(from, to)); }
    catch (error) { openSnackbarRef.current({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/", { replace: true }); return; }
    void load();
  }, [user?.role, navigate, load]);

  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0 || !category.trim()) {
      openSnackbar({ text: "Vui lòng nhập số tiền nguyên dương và nhóm chi phí", type: "warning" });
      return;
    }
    setSaving(true);
    try {
      await adminDashboardService.addExpense({ amount: value, category: category.trim(), note: note.trim(), spentAt });
      setExpenseOpen(false);
      setAmount(""); setCategory(""); setNote("");
      await load();
      openSnackbar({ text: "Đã ghi nhận khoản chi", type: "success" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error" }); }
    finally { setSaving(false); }
  };

  if (user?.role !== "admin") return <Navigate to="/" replace />;
  const summary = report?.summary;

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><Text.Title size="small" className="text-slate-900">Dashboard</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Doanh thu, chi phí và lợi nhuận mặt hàng</Text></div>
        <button type="button" onClick={() => setExpenseOpen(true)} className="flex min-h-10 items-center gap-2 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white"><Icon icon="zi-plus" />Nhập chi phí</button>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-slate-700">Từ ngày<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
        <label className="text-sm font-medium text-slate-700">Đến ngày<input required type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
        <button type="submit" disabled={loading} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-1">{loading && <Spinner />}Xem thống kê</button>
      </form>

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : report && <>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Tổng thu", summary?.totalRevenue || 0, "text-emerald-800", "bg-emerald-50"],
            ["Giá vốn hàng", summary?.goodsCost || 0, "text-slate-800", "bg-white"],
            ["Chi phí khác", summary?.otherExpenses || 0, "text-rose-800", "bg-rose-50"],
            ["Tổng chi", summary?.totalExpenses || 0, "text-slate-800", "bg-white"],
            ["Lợi nhuận", summary?.profit || 0, (summary?.profit || 0) >= 0 ? "text-emerald-800" : "text-rose-800", (summary?.profit || 0) >= 0 ? "bg-emerald-50" : "bg-rose-50"],
            ["Hóa đơn", summary?.paidBills || 0, "text-slate-800", "bg-white"],
          ].map(([label, value, color, bg]) => <article key={String(label)} className={`rounded-lg border border-slate-200 p-3 ${bg}`}><Text size="xSmall" className="font-medium text-slate-500">{label}</Text><Text className={`mt-1 block break-words text-lg font-bold ${color}`}>{label === "Hóa đơn" ? value : money(Number(value))}</Text></article>)}
        </section>

        <section className="space-y-2">
          <Text.Title size="small" className="text-slate-900">Đầu ra và lợi nhuận mặt hàng</Text.Title>
          {report.products.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-500">Chưa có mặt hàng được bán trong kỳ.</div> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_0.8fr_1fr_1fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 sm:grid"><span>Mặt hàng</span><span>Đầu ra</span><span>Doanh thu</span><span>Giá vốn</span><span>Lợi nhuận</span></div>
            {report.products.map((product) => <article key={product.productId} className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-3 last:border-0 sm:grid-cols-[minmax(0,1.4fr)_0.8fr_1fr_1fr_1fr] sm:items-center">
              <div className="col-span-2 min-w-0 sm:col-span-1"><Text size="small" className="truncate font-semibold text-slate-900">{product.name}</Text><Text size="xSmall" className="text-slate-500">{product.unitLabel || ""}</Text></div>
              <div><Text size="xSmall" className="text-slate-500 sm:hidden">Đầu ra</Text><Text size="small" className="font-medium">{product.outputQuantity.toLocaleString("vi-VN")}</Text></div>
              <div><Text size="xSmall" className="text-slate-500 sm:hidden">Doanh thu</Text><Text size="small" className="font-medium">{money(product.revenue)}</Text></div>
              <div><Text size="xSmall" className="text-slate-500 sm:hidden">Giá vốn</Text><Text size="small" className="font-medium">{money(product.cost)}</Text></div>
              <div><Text size="xSmall" className="text-slate-500 sm:hidden">Lợi nhuận</Text><Text size="small" className={`font-semibold ${product.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(product.profit)}</Text></div>
            </article>)}
          </div>}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2"><Text.Title size="small" className="text-slate-900">Kết quả theo ngày</Text.Title>{report.daily.length ? <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">{report.daily.map((day) => <article key={day.date} className="grid grid-cols-2 gap-2 p-3"><Text size="small" className="font-semibold">{new Date(`${day.date}T12:00:00+07:00`).toLocaleDateString("vi-VN")}</Text><Text size="small" className={`text-right font-bold ${day.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(day.profit)}</Text><Text size="xSmall" className="text-slate-500">Thu {money(day.revenue)} · Chi {money(day.productCost + day.expenses)}</Text><Text size="xSmall" className="text-right text-slate-500">Lợi nhuận</Text></article>)}</div> : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Chưa có dữ liệu trong kỳ.</div>}</div>
          <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Text.Title size="small" className="text-slate-900">Chi phí khác</Text.Title><Text size="xSmall" className="font-semibold text-rose-700">{money(summary?.otherExpenses || 0)}</Text></div>{report.expenses.length ? <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">{report.expenses.map((expense) => <article key={expense.id} className="flex items-start justify-between gap-3 p-3"><div className="min-w-0"><Text size="small" className="font-semibold text-slate-900">{expense.category}</Text><Text size="xSmall" className="mt-1 block break-words text-slate-500">{expense.note || new Date(expense.spentAt).toLocaleDateString("vi-VN")}</Text></div><Text size="small" className="shrink-0 font-semibold text-rose-700">{money(expense.amount)}</Text></article>)}</div> : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Chưa có khoản chi khác.</div>}</div>
        </section>
      </>}
    </main>

    <Sheet visible={expenseOpen} onClose={() => !saving && setExpenseOpen(false)} autoHeight swipeToClose>
      <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div className="flex items-center justify-between"><Text.Title size="small">Ghi nhận chi phí khác</Text.Title><button type="button" aria-label="Đóng" onClick={() => setExpenseOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
        <form onSubmit={(event) => void saveExpense(event)} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Số tiền (VNĐ)<input required type="text" inputMode="numeric" value={formatMoneyInput(amount)} onChange={(event) => handleMoneyInput(event, setAmount)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
          <label className="block text-sm font-medium text-slate-700">Nhóm chi phí<input required maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Điện nước, nhân sự..." className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
          <label className="block text-sm font-medium text-slate-700">Ngày chi<input required type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
          <label className="block text-sm font-medium text-slate-700">Ghi chú<textarea maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" /></label>
          <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-700 text-sm font-semibold text-white disabled:opacity-60">{saving && <Spinner />}Lưu khoản chi</button>
        </form>
      </Box>
    </Sheet>
  </Page>;
}

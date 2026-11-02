import { useCallback, useEffect, useState } from "react";
import { Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router-dom";

import { tableBillHistoryService } from "@/api/services";
import type { TableBillingReport } from "@/api/pocketbase";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";
import AdminNav from "@/components/admin-nav";

const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const methodLabel: Record<string, string> = { cash: "Tiền mặt", transfer: "Chuyển khoản", wallet: "Ví" };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

function messageOf(error: any) {
  return error?.response?.data?.error || error?.response?.message || error?.message || "Không thể tải báo cáo";
}

export default function AdminReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [tableName, setTableName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [report, setReport] = useState<TableBillingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    if (nextPage === 1) setLoading(true); else setLoadingMore(true);
    try {
      const result = await tableBillHistoryService.report({ from, to, tableName: tableName.trim(), paymentMethod, page: nextPage });
      setReport((current) => nextPage === 1 || !current ? result : { ...result, payments: [...current.payments, ...result.payments] });
    } catch (error) {
      openSnackbar({ text: messageOf(error), type: "error", position: "top" });
    } finally {
      if (nextPage === 1) setLoading(false); else setLoadingMore(false);
    }
  }, [from, to, tableName, paymentMethod, openSnackbar]);

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/", { replace: true }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, navigate]);

  if (user?.role !== "admin") return null;
  const summary = report?.summary;

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
      <header className="flex items-center gap-3">
        <button aria-label="Quay lại sơ đồ bàn" title="Quay lại" onClick={() => navigate("/")} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm"><Icon icon="zi-arrow-left" /></button>
        <div className="min-w-0 flex-1"><Text.Title size="small" className="text-slate-900">Báo cáo doanh thu</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Lịch sử thanh toán đã hoàn tất</Text></div>
        <button onClick={() => navigate("/admin/bill-history")} className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"><Icon icon="zi-clock-1" />Lịch sử bill</button>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">Từ ngày<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label><label className="text-sm font-medium text-slate-700">Đến ngày<input required type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">Tên bàn<input value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="Ví dụ: Bàn 1" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label><label className="text-sm font-medium text-slate-700">Phương thức<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"><option value="">Tất cả</option><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="wallet">Ví</option></select></label></div>
        <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{loading && <Spinner />}Xem báo cáo</button>
      </form>

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : !report ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có dữ liệu báo cáo.</div> : <><section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Tổng doanh thu", summary?.totalRevenue || 0, "col-span-2 bg-emerald-50 text-emerald-800"], ["Số hóa đơn", summary?.paidBills || 0, "bg-white text-slate-800"], ["Tiền mặt", summary?.cashAmount || 0, "bg-white text-slate-800"], ["Chuyển khoản", summary?.transferAmount || 0, "bg-white text-slate-800"], ["Ví", summary?.walletAmount || 0, "bg-white text-slate-800"]].map(([label, value, style]) => <div key={String(label)} className={`rounded-lg border border-slate-200 p-3 ${style}`}><Text size="xSmall" className="font-medium opacity-75">{label}</Text><Text className="mt-1 block text-lg font-bold">{label === "Số hóa đơn" ? value : money(Number(value))}</Text></div>)}</section>
        <section className="space-y-2"><Text.Title size="small" className="text-slate-900">Doanh thu theo ngày</Text.Title>{report.daily.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Không có giao dịch trong khoảng ngày đã chọn.</div> : <div className="space-y-2">{report.daily.map((day) => <article key={day.date} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><Text className="font-semibold text-slate-900">{new Date(`${day.date}T12:00:00+07:00`).toLocaleDateString("vi-VN")}</Text><Text className="font-bold text-emerald-700">{money(day.totalRevenue)}</Text></div><Text size="xSmall" className="mt-1 block text-slate-500">{day.paidBills} hóa đơn · Tiền mặt {money(day.cashAmount)} · Chuyển khoản {money(day.transferAmount)} · Ví {money(day.walletAmount)}</Text></article>)}</div>}</section>
        <section className="space-y-2"><Text.Title size="small" className="text-slate-900">Lịch sử thanh toán</Text.Title>{report.payments.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Chưa có thanh toán.</div> : <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">{report.payments.map((payment) => <article key={payment.id} className="flex items-center gap-3 px-3 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Icon icon="zi-list-1" /></div><div className="min-w-0 flex-1"><Text size="small" className="font-semibold text-slate-900">{payment.tableName} · {money(payment.amount)}</Text><Text size="xSmall" className="mt-1 block text-slate-500">{dateTime(payment.paidAt)} · {methodLabel[payment.paymentMethod] || payment.paymentMethod}</Text><Text size="xSmall" className="mt-1 block text-slate-500">{payment.actorName}</Text></div><button onClick={() => navigate(`/bills/${payment.billId}`)} aria-label="Mở bill" title="Mở bill" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon icon="zi-arrow-right" /></button></article>)}</div>}{report.hasMore && <button disabled={loadingMore} onClick={() => void load(report.page + 1)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50">{loadingMore && <Spinner />}Xem thêm</button>}</section>
      </>}
    </main>
  </Page>;
}

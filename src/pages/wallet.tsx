import { useEffect, useMemo, useState } from "react";
import { Icon, Page, Spinner, Text, Sheet, Box } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { walletService } from "@/api/services";
import type { WalletSummary, WalletTransaction } from "@/api/pocketbase";

const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [type, setType] = useState<"all" | "main" | "promo">("all");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([walletService.getMine(), walletService.getMyTransactions()])
      .then(([summary, history]) => { setWallet(summary); setTransactions(history.items); setHistoryTotal(history.totalItems); })
      .catch(() => setError("Không thể tải thông tin ví. Vui lòng thử lại."))
      .then(() => setLoading(false));
  }, []);

  const visibleTransactions = useMemo(() => transactions.filter((item) => {
    const created = new Date(item.created).getTime();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
    return created >= from && created <= to && (type === "all" || item.wallet_type === type) && (direction === "all" || item.direction === direction);
  }), [transactions, type, direction, fromDate, toDate]);

  if (loading) return <Page className="flex items-center justify-center bg-slate-50"><Spinner /></Page>;
  return (
    <Page className="min-h-screen bg-slate-50 pb-24 dark:bg-black">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 pb-3 pt-12 dark:border-white/10 dark:bg-black">
        <button aria-label="Quay lại" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10"><Icon icon="zi-arrow-left" /></button>
        <Text.Title size="small">Ví tài khoản</Text.Title>
      </header>
      <main className="space-y-4 px-4 py-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><Text size="xSmall" className="text-slate-500">Tài khoản chính</Text><Text.Title className="mt-2 text-green-600">{money(wallet?.mainBalance || 0)}</Text.Title></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><Text size="xSmall" className="text-slate-500">Tài khoản khuyến mại</Text><Text.Title className="mt-2 text-orange-500">{money(wallet?.promoBalance || 0)}</Text.Title></div>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between"><Text.Title size="small">Khuyến mại sắp hết hạn</Text.Title><Icon icon="zi-star" className="text-orange-500" /></div>
          {wallet?.promoLots.length ? wallet.promoLots.map((lot) => <div key={lot.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 dark:border-white/10"><div><Text size="small">Còn {money(lot.remainingAmount)}</Text><Text size="xSmall" className="text-slate-500">Hết hạn {new Date(lot.expiresAt).toLocaleDateString("vi-VN")}</Text></div><Text size="xSmall" className="text-orange-600">Ưu tiên dùng trước</Text></div>) : <Text size="small" className="text-slate-500">Không có lô khuyến mại còn hạn.</Text>}
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between"><Text.Title size="small">Lịch sử giao dịch</Text.Title><button aria-label="Lọc lịch sử" onClick={() => setFilterOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10"><Icon icon="zi-filter" /></button></div>
          {visibleTransactions.length ? visibleTransactions.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 dark:border-white/10"><div className="min-w-0"><Text size="small" className="truncate">{item.reason}</Text><Text size="xSmall" className="text-slate-500">{new Date(item.created).toLocaleString("vi-VN")} · {item.wallet_type === "promo" ? "Khuyến mại" : "Tài khoản chính"}</Text></div><Text size="small" className={item.direction === "credit" ? "font-semibold text-green-600" : "font-semibold text-red-500"}>{item.direction === "credit" ? "+" : "-"}{money(item.amount)}</Text></div>) : <Text size="small" className="text-slate-500">Chưa có giao dịch phù hợp.</Text>}
          {transactions.length < historyTotal && <button onClick={() => walletService.getMyTransactions(historyPage + 1).then((next) => { setTransactions((current) => [...current, ...next.items]); setHistoryPage(next.page); })} className="mt-3 w-full rounded-lg border py-2 text-sm text-green-700">Xem thêm</button>}
        </section>
      </main>
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} autoHeight><Box className="space-y-4 px-4 pb-8 pt-4"><Text.Title size="small">Lọc lịch sử</Text.Title><label className="block text-sm">Loại tiền<select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-2 w-full rounded-lg border p-3"><option value="all">Tất cả</option><option value="main">Tài khoản chính</option><option value="promo">Khuyến mại</option></select></label><label className="block text-sm">Loại giao dịch<select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} className="mt-2 w-full rounded-lg border p-3"><option value="all">Tất cả</option><option value="credit">Tăng tiền</option><option value="debit">Giảm tiền</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">Từ ngày<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label><label className="text-sm">Đến ngày<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label></div><button onClick={() => setFilterOpen(false)} className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white">Áp dụng</button></Box></Sheet>
    </Page>
  );
}

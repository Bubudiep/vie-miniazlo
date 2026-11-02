import { useEffect, useMemo, useState } from "react";
import { Icon, Page, Spinner, Text, Sheet, Box } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { walletService } from "@/api/services";
import type { WalletSummary, WalletTransaction, WalletTopup, WalletTopupPayment } from "@/api/pocketbase";

const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [topups, setTopups] = useState<WalletTopup[]>([]);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState(100000);
  const [topupNote, setTopupNote] = useState("");
  const [topupProof, setTopupProof] = useState("");
  const [topup, setTopup] = useState<WalletTopup | null>(null);
  const [topupPayment, setTopupPayment] = useState<WalletTopupPayment | null>(null);
  const [topupBusy, setTopupBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [type, setType] = useState<"all" | "main" | "promo">("all");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([walletService.getMine(), walletService.getMyTransactions(), walletService.getMyTopups()])
      .then(([summary, history, topupHistory]) => { setWallet(summary); setTransactions(history.items); setHistoryTotal(history.totalItems); setTopups(topupHistory.items); })
      .catch(() => setError("Không thể tải thông tin ví. Vui lòng thử lại."))
      .then(() => setLoading(false));
  }, []);

  const createTopup = async () => {
    if (!Number.isInteger(topupAmount) || topupAmount < 1000) return setError("Số tiền nạp tối thiểu là 1.000đ.");
    setTopupBusy(true);
    setError("");
    try {
      const result = await walletService.createTopup({ amount: topupAmount, note: topupNote, proof: topupProof, idempotencyKey: `topup-${user?.id || "user"}-${Date.now()}` });
      setTopup(result.topup);
      setTopupPayment(result.payment);
      setTopups((current) => [result.topup, ...current.filter((item) => item.id !== result.topup.id)]);
    } catch (requestError: any) {
      setError(requestError?.response?.message || requestError?.response?.data?.error || "Không thể tạo yêu cầu nạp tiền.");
    } finally {
      setTopupBusy(false);
    }
  };

  const topupQrUrl = topup && topupPayment ? `https://img.vietqr.io/image/${encodeURIComponent(topupPayment.bankId)}-${encodeURIComponent(topupPayment.accountNumber)}-compact2.png?amount=${topup.amount}&addInfo=${encodeURIComponent(topup.transferCode)}&accountName=${encodeURIComponent(topupPayment.accountName)}` : "";
  const statusLabel: Record<string, string> = { pending: "Chờ cửa hàng duyệt", paid: "Đã cộng tiền", rejected: "Đã từ chối", expired: "Đã hết hạn" };

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
        <Text.Title size="small" className="flex-1">Ví tài khoản</Text.Title>
        <button type="button" onClick={() => { setTopup(null); setTopupPayment(null); setTopupOpen(true); }} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white">Nạp tiền</button>
      </header>
      <main className="space-y-4 px-4 py-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><Text size="xSmall" className="text-slate-500">Tài khoản chính</Text><Text.Title className="mt-2 text-green-600">{money(wallet?.mainBalance || 0)}</Text.Title></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><Text size="xSmall" className="text-slate-500">Tài khoản khuyến mại</Text><Text.Title className="mt-2 text-orange-500">{money(wallet?.promoBalance || 0)}</Text.Title></div>
        </section>
        {topups.length > 0 && <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><div className="mb-3 flex items-center justify-between"><Text.Title size="small">Yêu cầu nạp gần đây</Text.Title><Text size="xSmall" className="text-slate-500">{topups.length}</Text></div><div className="space-y-3">{topups.slice(0, 3).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-white/10"><div className="min-w-0"><Text size="small" className="font-semibold">{money(item.amount)}</Text><Text size="xSmall" className="mt-1 block text-slate-500">Mã chuyển khoản: {item.transferCode}</Text></div><Text size="xSmall" className={item.status === "paid" ? "text-green-600" : item.status === "rejected" ? "text-red-600" : "text-orange-600"}>{statusLabel[item.status]}</Text></div>)}</div></section>}
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
      <Sheet visible={topupOpen} onClose={() => !topupBusy && setTopupOpen(false)} autoHeight swipeToClose unmountOnClose><Box className="max-h-[88vh] space-y-4 overflow-y-auto px-4 pb-8 pt-4"><div className="flex items-center justify-between"><Text.Title size="small">Nạp tiền vào ví</Text.Title><button aria-label="Đóng nạp tiền" onClick={() => setTopupOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>{!topup ? <><Text size="small" className="text-slate-600">Tạo yêu cầu, sau đó chuyển khoản đúng số tiền và nội dung bên dưới.</Text><label className="block text-sm font-medium">Số tiền nạp<input type="number" min="1000" step="1000" inputMode="numeric" value={topupAmount} onChange={(event) => setTopupAmount(Number(event.target.value) || 0)} className="mt-2 min-h-12 w-full rounded-lg border px-3 text-lg" /></label><label className="block text-sm font-medium">Mã giao dịch/chứng từ (không bắt buộc)<input value={topupProof} onChange={(event) => setTopupProof(event.target.value)} maxLength={500} className="mt-2 min-h-11 w-full rounded-lg border px-3" placeholder="Nhập sau khi chuyển khoản nếu có" /></label><label className="block text-sm font-medium">Ghi chú (không bắt buộc)<textarea value={topupNote} onChange={(event) => setTopupNote(event.target.value)} maxLength={500} className="mt-2 min-h-20 w-full rounded-lg border p-3" placeholder="Ví dụ: Nạp tiền chơi cuối tuần" /></label><button type="button" disabled={topupBusy} onClick={() => void createTopup()} className="min-h-12 w-full rounded-xl bg-green-600 px-4 font-semibold text-white disabled:opacity-60">{topupBusy ? "Đang tạo yêu cầu..." : "Tạo yêu cầu nạp"}</button></> : <div className="space-y-4"><div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">Yêu cầu đã tạo. Vui lòng chuyển đúng <strong>{money(topup.amount)}</strong> và ghi nội dung <strong>{topup.transferCode}</strong>.</div>{topupQrUrl && <img src={topupQrUrl} alt="Mã QR nạp tiền vào ví" className="mx-auto aspect-square w-56 rounded-lg border bg-white object-contain" />}<div className="space-y-1 text-center"><Text size="small" className="font-semibold">{topupPayment?.accountName}</Text><Text size="xSmall" className="text-slate-600">{topupPayment?.bankId} · {topupPayment?.accountNumber}</Text></div><Text size="small" className="text-center text-orange-700">Trạng thái: {statusLabel[topup.status]}. Admin sẽ kiểm tra giao dịch và cộng tiền vào ví.</Text><button type="button" onClick={() => setTopupOpen(false)} className="min-h-12 w-full rounded-xl border border-slate-300 font-semibold">Đóng</button></div>}</Box></Sheet>
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} autoHeight><Box className="space-y-4 px-4 pb-8 pt-4"><Text.Title size="small">Lọc lịch sử</Text.Title><label className="block text-sm">Loại tiền<select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-2 w-full rounded-lg border p-3"><option value="all">Tất cả</option><option value="main">Tài khoản chính</option><option value="promo">Khuyến mại</option></select></label><label className="block text-sm">Loại giao dịch<select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} className="mt-2 w-full rounded-lg border p-3"><option value="all">Tất cả</option><option value="credit">Tăng tiền</option><option value="debit">Giảm tiền</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">Từ ngày<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label><label className="text-sm">Đến ngày<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label></div><button onClick={() => setFilterOpen(false)} className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white">Áp dụng</button></Box></Sheet>
    </Page>
  );
}

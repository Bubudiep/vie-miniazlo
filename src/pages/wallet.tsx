import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Page, Spinner, Text, Sheet, Box, useSnackbar } from "zmp-ui";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { walletService } from "@/api/services";
import type { WalletSummary, WalletTransaction, WalletTopup, WalletTopupPayment } from "@/api/pocketbase";

type BankApp = { appId: string; appName: string; appLogo?: string; autofill?: number };
type TopupResume = { topup: WalletTopup; payment: WalletTopupPayment };

const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const TOPUP_RESUME_KEY = "wallet-topup-resume";
const formatAmountInput = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};
const getAmount = (value: string) => Number(value.replace(/\D/g, "")) || 0;

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openSnackbar } = useSnackbar();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [topups, setTopups] = useState<WalletTopup[]>([]);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmountInput, setTopupAmountInput] = useState("100.000");
  const [topup, setTopup] = useState<WalletTopup | null>(null);
  const [topupPayment, setTopupPayment] = useState<WalletTopupPayment | null>(null);
  const [topupBusy, setTopupBusy] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankApps, setBankApps] = useState<BankApp[]>([]);
  const [bankAppsLoading, setBankAppsLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [type, setType] = useState<"all" | "main" | "promo">("all");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const confirmedTransfer = useRef(false);
  const topupAmount = getAmount(topupAmountInput);

  useEffect(() => {
    let active = true;
    const refreshWallet = async (initial = false) => {
      try {
        const [summary, history, topupHistory] = await Promise.all([walletService.getMine(), walletService.getMyTransactions(), walletService.getMyTopups()]);
        if (!active) return;
        setWallet(summary);
        setTransactions(history.items);
        setHistoryTotal(history.totalItems);
        setTopups(topupHistory.items);
        setTopup((current) => topupHistory.items.find((item) => item.id === current?.id) || current);
      } catch {
        if (initial && active) setError("Không thể tải thông tin ví. Vui lòng thử lại.");
      } finally {
        if (initial && active) setLoading(false);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshWallet();
    };
    void refreshWallet(true);
    const timer = window.setInterval(refreshWhenVisible, 5000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const topupId = searchParams.get("topupId");
    if (topupId) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(TOPUP_RESUME_KEY) || "") as TopupResume;
        if (saved.topup.id === topupId) {
          confirmedTransfer.current = false;
          setTopup(saved.topup);
          setTopupPayment(saved.payment);
          setTopupOpen(true);
          navigate("/account/wallet", { replace: true });
          return;
        }
      } catch {}
    }
    if (searchParams.get("topup") === "1") {
      openTopup();
      navigate("/account/wallet", { replace: true });
    }
  }, [loading, searchParams]);

  const openTopup = () => {
    confirmedTransfer.current = false;
    setTopup(null);
    setTopupPayment(null);
    setError("");
    setTopupOpen(true);
  };

  const createTopup = async () => {
    if (!Number.isInteger(topupAmount) || topupAmount < 1000) return setError("Số tiền nạp tối thiểu là 1.000đ.");
    setTopupBusy(true);
    setError("");
    try {
      const result = await walletService.createTopup({ amount: topupAmount, idempotencyKey: `topup-${user?.id || "user"}-${Date.now()}` });
      setTopup(result.topup);
      setTopupPayment(result.payment);
      setTopups((current) => [result.topup, ...current.filter((item) => item.id !== result.topup.id)]);
    } catch (requestError: any) {
      setError(requestError?.response?.message || requestError?.response?.data?.error || "Không thể tạo yêu cầu nạp tiền.");
    } finally {
      setTopupBusy(false);
    }
  };

  const closeTopup = async () => {
    if (topupBusy) return;
    setTopupOpen(false);
    window.localStorage.removeItem(TOPUP_RESUME_KEY);
    if (!topup || confirmedTransfer.current || topup.status !== "pending") return;
    setTopupBusy(true);
    try {
      const result = await walletService.cancelTopup(topup.id);
      setTopups((current) => result.topup.status === "expired"
        ? current.filter((item) => item.id !== topup.id)
        : current.map((item) => item.id === topup.id ? { ...item, ...result.topup } : item));
    } catch {
      // A webhook may have completed the top-up while the sheet was open.
    } finally {
      setTopupBusy(false);
    }
  };

  const confirmTransfer = () => {
    confirmedTransfer.current = true;
    window.localStorage.removeItem(TOPUP_RESUME_KEY);
    setTopupOpen(false);
    openSnackbar({ text: "Đã ghi nhận. Ví sẽ được cộng tự động khi ngân hàng xác nhận giao dịch.", type: "success", position: "top" });
  };

  const topupQrUrl = topup && topupPayment
    ? `https://img.vietqr.io/image/${encodeURIComponent(topupPayment.bankId)}-${encodeURIComponent(topupPayment.accountNumber)}-compact2.png?amount=${topup.amount}&addInfo=${encodeURIComponent(topup.transferCode)}&accountName=${encodeURIComponent(topupPayment.accountName)}`
    : "";
  const statusLabel: Record<string, string> = { pending: "Chờ ngân hàng xác nhận", paid: "Đã cộng tiền", rejected: "Đã từ chối", expired: "Chưa thanh toán" };

  const transferUrl = (appId: string) => {
    if (!topup || !topupPayment) return "";
    const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");
    const returnUrl = `${window.location.origin}/account/wallet?topupId=${topup.id}`;
    return `https://dl.vietqr.io/pay?app=${encode(appId)}&am=${topup.amount}&tn=${encode(topup.transferCode)}&ba=${topupPayment.accountNumber}@${topupPayment.bankId.toLowerCase()}&bn=${encode(topupPayment.accountName)}&url=${returnUrl}`;
  };

  const openBankTransfer = async () => {
    const savedAppId = window.localStorage.getItem("wallet-topup-bank-app");
    if (savedAppId) {
      window.localStorage.setItem(TOPUP_RESUME_KEY, JSON.stringify({ topup, payment: topupPayment }));
      window.location.assign(transferUrl(savedAppId));
      return;
    }
    setBankPickerOpen(true);
    if (bankApps.length || bankAppsLoading) return;
    setBankAppsLoading(true);
    try {
      const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
      const response = await fetch(`https://api.vietqr.io/v2/${isIos ? "ios" : "android"}-app-deeplinks`);
      const data = await response.json() as { apps?: BankApp[] };
      const apps = (data.apps || []).filter((app) => app.appId && app.appName && Number(app.autofill) === 1);
      if (!apps.length) throw new Error("Không có ứng dụng hỗ trợ");
      setBankApps(apps);
    } catch {
      setBankPickerOpen(false);
      openSnackbar({ text: "Không tải được danh sách ứng dụng ngân hàng. Bạn vẫn có thể quét mã QR để thanh toán.", type: "warning", position: "top" });
    } finally {
      setBankAppsLoading(false);
    }
  };

  const selectBankApp = (appId: string) => {
    window.localStorage.setItem("wallet-topup-bank-app", appId);
    window.localStorage.setItem(TOPUP_RESUME_KEY, JSON.stringify({ topup, payment: topupPayment }));
    setBankPickerOpen(false);
    window.location.assign(transferUrl(appId));
  };

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
        <button type="button" onClick={openTopup} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white">Nạp tiền</button>
      </header>
      <main className="space-y-4 px-4 py-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><Text size="xSmall" className="text-slate-500">Tài khoản chính</Text><Text.Title className="mt-2 text-green-600">{money(wallet?.mainBalance || 0)}</Text.Title></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><Text size="xSmall" className="text-slate-500">Tài khoản khuyến mại</Text><Text.Title className="mt-2 text-orange-500">{money(wallet?.promoBalance || 0)}</Text.Title></div>
        </section>
        {topups.length > 0 && <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><div className="mb-3 flex items-center justify-between"><Text.Title size="small">Yêu cầu nạp gần đây</Text.Title><Text size="xSmall" className="text-slate-500">{topups.length}</Text></div><div className="space-y-3">{topups.slice(0, 3).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-white/10"><div className="min-w-0"><Text size="small" className="font-semibold">{money(item.amount)}</Text><Text size="xSmall" className="mt-1 block text-slate-500">Mã chuyển khoản: {item.transferCode}</Text></div><Text size="xSmall" className={item.status === "paid" ? "text-green-600" : item.status === "rejected" ? "text-red-600" : "text-orange-600"}>{statusLabel[item.status]}</Text></div>)}</div></section>}
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><div className="mb-3 flex items-center justify-between"><Text.Title size="small">Khuyến mại sắp hết hạn</Text.Title><Icon icon="zi-star" className="text-orange-500" /></div>{wallet?.promoLots.length ? wallet.promoLots.map((lot) => <div key={lot.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 dark:border-white/10"><div><Text size="small">Còn {money(lot.remainingAmount)}</Text><Text size="xSmall" className="text-slate-500">Hết hạn {new Date(lot.expiresAt).toLocaleDateString("vi-VN")}</Text></div><Text size="xSmall" className="text-orange-600">Ưu tiên dùng trước</Text></div>) : <Text size="small" className="text-slate-500">Không có lô khuyến mại còn hạn.</Text>}</section>
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"><div className="mb-2 flex items-center justify-between"><Text.Title size="small">Lịch sử giao dịch</Text.Title><button aria-label="Lọc lịch sử" onClick={() => setFilterOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10"><Icon icon="zi-filter" /></button></div>{visibleTransactions.length ? visibleTransactions.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 dark:border-white/10"><div className="min-w-0"><Text size="small" className="truncate">{item.reason}</Text><Text size="xSmall" className="text-slate-500">{new Date(item.created).toLocaleString("vi-VN")} · {item.wallet_type === "promo" ? "Khuyến mại" : "Tài khoản chính"}</Text></div><Text size="small" className={item.direction === "credit" ? "font-semibold text-green-600" : "font-semibold text-red-500"}>{item.direction === "credit" ? "+" : "-"}{money(item.amount)}</Text></div>) : <Text size="small" className="text-slate-500">Chưa có giao dịch phù hợp.</Text>}{transactions.length < historyTotal && <button onClick={() => walletService.getMyTransactions(historyPage + 1).then((next) => { setTransactions((current) => [...current, ...next.items]); setHistoryPage(next.page); })} className="mt-3 w-full rounded-lg border py-2 text-sm text-green-700">Xem thêm</button>}</section>
      </main>
      <Sheet visible={topupOpen} onClose={() => void closeTopup()} autoHeight swipeToClose unmountOnClose><Box className="max-h-[88vh] space-y-4 overflow-y-auto px-4 pb-8 pt-4"><div className="flex items-center justify-between"><Text.Title size="small">Nạp tiền vào ví</Text.Title><button aria-label="Đóng nạp tiền" onClick={() => void closeTopup()} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>{!topup ? <><Text size="small" className="text-slate-600">Nhập số tiền cần nạp. Tài khoản nhận, mã QR và nội dung chuyển khoản được tạo tự động.</Text><label className="block text-sm font-medium">Số tiền nạp<input type="text" inputMode="numeric" value={topupAmountInput} onChange={(event) => setTopupAmountInput(formatAmountInput(event.target.value))} placeholder="Ví dụ: 100.000" className="mt-2 min-h-12 w-full rounded-lg border px-3 text-right text-lg font-semibold" /></label>{topupAmount > 0 && <Text size="xSmall" className="block text-right text-slate-500">{money(topupAmount)}</Text>}<button type="button" disabled={topupBusy} onClick={() => void createTopup()} className="min-h-12 w-full rounded-xl bg-green-600 px-4 font-semibold text-white disabled:opacity-60">{topupBusy ? "Đang tạo yêu cầu..." : "Tạo yêu cầu nạp"}</button></> : <div className="space-y-4"><div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">Chuyển đúng <strong>{money(topup.amount)}</strong> với nội dung <strong>{topup.transferCode}</strong>.</div>{topupQrUrl && <img src={topupQrUrl} alt="Mã QR nạp tiền vào ví" className="mx-auto aspect-square w-56 rounded-lg border bg-white object-contain" />}<div className="space-y-1 text-center"><Text size="small" className="font-semibold">{topupPayment?.accountName}</Text><Text size="xSmall" className="text-slate-600">{topupPayment?.bankId} · {topupPayment?.accountNumber}</Text></div>{topup.status === "paid" ? <><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800">Đã nhận xác nhận từ SePay và cộng {money(topup.amount)} vào ví.</div><button type="button" onClick={() => void closeTopup()} className="min-h-12 w-full rounded-xl bg-green-600 text-sm font-semibold text-white">Hoàn tất</button></> : <><Text size="xSmall" className="block text-center text-slate-500">Sau khi chuyển khoản, bấm Thanh toán để hệ thống chờ ngân hàng xác nhận.</Text><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => void closeTopup()} className="min-h-12 rounded-xl border border-slate-300 text-sm font-semibold leading-tight text-slate-700">Đóng</button><button type="button" onClick={() => void openBankTransfer()} className="min-h-12 rounded-xl border border-emerald-600 px-2 text-sm font-semibold leading-tight text-emerald-700">Chuyển khoản</button><button type="button" onClick={confirmTransfer} className="min-h-12 rounded-xl bg-green-600 px-2 text-sm font-semibold leading-tight text-white">Thanh toán</button></div></>}</div>}</Box></Sheet>
      <Sheet visible={bankPickerOpen} onClose={() => setBankPickerOpen(false)} autoHeight swipeToClose unmountOnClose><Box className="max-h-[80vh] space-y-3 overflow-y-auto px-4 pb-8 pt-4"><div className="flex items-center justify-between"><Text.Title size="small">Chọn ứng dụng ngân hàng</Text.Title><button aria-label="Đóng danh sách ngân hàng" onClick={() => setBankPickerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div><Text size="xSmall" className="block text-slate-500">Ứng dụng được chọn sẽ tự điền số tiền và nội dung chuyển khoản, đồng thời được ghi nhớ cho lần sau.</Text>{bankAppsLoading ? <div className="flex justify-center py-8"><Spinner /></div> : bankApps.map((app) => <button key={app.appId} type="button" onClick={() => selectBankApp(app.appId)} className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-slate-100">{app.appLogo ? <img src={app.appLogo} alt="" className="h-full w-full object-cover" /> : <Icon icon="zi-wallet" />}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{app.appName}</span><Icon icon="zi-chevron-right" className="text-slate-400" /></button>)}</Box></Sheet>
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} autoHeight><Box className="space-y-4 px-4 pb-8 pt-4"><Text.Title size="small">Lọc lịch sử</Text.Title><label className="block text-sm">Loại tiền<select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="mt-2 w-full rounded-lg border p-3"><option value="all">Tất cả</option><option value="main">Tài khoản chính</option><option value="promo">Khuyến mại</option></select></label><label className="block text-sm">Loại giao dịch<select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)} className="mt-2 w-full rounded-lg border p-3"><option value="all">Tất cả</option><option value="credit">Tăng tiền</option><option value="debit">Giảm tiền</option></select></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">Từ ngày<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label><label className="text-sm">Đến ngày<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label></div><button onClick={() => setFilterOpen(false)} className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white">Áp dụng</button></Box></Sheet>
    </Page>
  );
}

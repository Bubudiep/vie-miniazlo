import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";

import { tableBillingService } from "@/api/services";
import type { TableBill, TableBillProduct } from "@/api/pocketbase";
import { formatVietnamDateTime } from "@/utils/format";

const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;

export default function PublicBillPage() {
  const { tableId = "" } = useParams<{ tableId: string }>();
  const [bill, setBill] = useState<TableBill | null>(null);
  const [menu, setMenu] = useState<TableBillProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [storeName, setStoreName] = useState("H2 Billiards");
  const [tableName, setTableName] = useState("Bàn");
  const [payment, setPayment] = useState({ bankId: "", accountNumber: "", accountName: "" });
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankApps, setBankApps] = useState<{ appId: string; appName: string; appLogo?: string }[]>([]);
  const [bankAppsLoading, setBankAppsLoading] = useState(false);
  const { openSnackbar } = useSnackbar();

  const load = () => tableBillingService.getPublicDetail(tableId).then((result) => {
      setError("");
      setBill(result.bill);
      setMenu(result.menu || []);
      setStoreName(result.storeName || "H2 Billiards");
      setTableName(result.tableName || "Bàn");
      setPayment(result.payment);
      setLoaded(true);
    }).catch((reason) => {
      setError(reason?.response?.data?.error || "Không tìm thấy hóa đơn hoặc đường dẫn đã hết hiệu lực.");
      setLoaded(true);
    });
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [tableId]);

  const requestPayment = async () => {
    setBusy(true);
    try {
      if (!bill) return;
      await tableBillingService.requestPublicTransfer(tableId, bill.id);
      await load();
      openSnackbar({ text: "Đã gửi yêu cầu xác nhận thanh toán đến cửa hàng", type: "success", position: "top" });
    } catch (reason: any) {
      openSnackbar({ text: reason?.response?.data?.error || "Không thể gửi yêu cầu thanh toán", type: "error", position: "top" });
    } finally { setBusy(false); }
  };

  const openBankPicker = async () => {
    setBankPickerOpen(true);
    if (bankApps.length || bankAppsLoading) return;
    setBankAppsLoading(true);
    try {
      const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
      const response = await fetch(`https://api.vietqr.io/v2/${isIos ? "ios" : "android"}-app-deeplinks`);
      const data = await response.json() as { apps?: { appId: string; appName: string; appLogo?: string; autofill?: number }[] };
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
    const amount = Math.round(bill?.requestedAmount || bill?.totalAmount || 0);
    const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");
    const returnUrl = `${window.location.origin}/public-tables/${encodeURIComponent(tableId)}`;
    const transferUrl = `https://dl.vietqr.io/pay?app=${encode(appId)}&am=${amount}&tn=${encode(`Bill ${bill?.tableName} ${bill?.id}`)}&ba=${payment.accountNumber}@${payment.bankId.toLowerCase()}&bn=${encode(payment.accountName)}&url=${returnUrl}`;
    setBankPickerOpen(false);
    window.location.assign(transferUrl);
  };

  const requestOrder = async () => {
    if (!bill) return;
    const items = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
    if (!items.length) {
      openSnackbar({ text: "Vui lòng chọn ít nhất một món", type: "warning", position: "top" });
      return;
    }
    setBusy(true);
    try {
      const result = await tableBillingService.requestPublicOrder(tableId, bill.id, items);
      setBill(result.bill);
      setQuantities({});
      setMenuOpen(false);
      openSnackbar({ text: "Đã gửi yêu cầu món. Cửa hàng sẽ xác nhận trước khi tính vào bill.", type: "success", position: "top" });
    } catch (reason: any) {
      openSnackbar({ text: reason?.response?.data?.error || "Không thể gửi yêu cầu món", type: "error", position: "top" });
      void load();
    } finally { setBusy(false); }
  };

  if (!loaded && !error) return <Page className="min-h-screen bg-slate-50"><div className="flex justify-center py-20"><Spinner /></div></Page>;
  if (error) return <Page className="min-h-screen bg-slate-50 px-4 py-16"><div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-white p-5 text-center text-rose-800">{error}</div></Page>;
  if (!bill) return <Page className="min-h-screen bg-slate-50 px-4 py-6"><main className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 text-center"><Text.Title size="small">{storeName}</Text.Title><Text size="small" className="mt-2 block text-slate-600">{tableName} hiện chưa có hóa đơn. Trang sẽ tự cập nhật khi có bill mới.</Text></main></Page>;

  const paymentPending = bill.status === "wallet_pending" && bill.paymentMethod === "transfer";
  const otherPaymentPending = bill.status === "wallet_pending" && !paymentPending;
  const status = bill.status === "paid" ? "Đã thanh toán" : bill.status === "cancelled" ? "Đã hủy" : paymentPending ? "Chờ xác nhận" : otherPaymentPending ? "Chờ duyệt ví" : bill.status === "stopped" ? "Chưa thanh toán" : "Đang sử dụng";
  const qrUrl = payment.bankId && payment.accountNumber ? `https://img.vietqr.io/image/${encodeURIComponent(payment.bankId)}-${encodeURIComponent(payment.accountNumber)}-compact2.png?amount=${Math.round(bill.requestedAmount || bill.totalAmount)}&addInfo=${encodeURIComponent(`Bill ${bill.tableName} ${bill.id}`)}&accountName=${encodeURIComponent(payment.accountName)}` : "";
  return <Page className="min-h-screen bg-slate-50 px-4 py-6">
    <main className="mx-auto max-w-md space-y-4 pb-6">
      <header className="rounded-xl bg-emerald-700 px-4 py-5 text-center text-white shadow-sm">
        <Text.Title size="small" className="text-white">{storeName}</Text.Title>
        <Text size="small" className="mt-1 block text-emerald-100">Hóa đơn của bạn</Text>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><Text size="small" className="text-slate-500">Mã bill</Text><Text className="break-all font-semibold text-slate-900">{bill.id}</Text></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm"><div><span className="block text-slate-500">Bàn</span><strong>{bill.tableName}</strong></div><div><span className="block text-slate-500">Thời gian</span><strong>{formatVietnamDateTime(bill.paidAt || bill.startedAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong></div></div>
      </section>
      {bill.items.some((item) => item.queueStatus === "approval_pending" || item.queueStatus === "rejected") && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><Text.Title size="small">Yêu cầu món</Text.Title><div className="mt-2 divide-y divide-amber-200">{bill.items.filter((item) => item.queueStatus === "approval_pending" || item.queueStatus === "rejected").map((item) => <div key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span>{item.name} · {item.quantity} {item.unitLabel}</span><strong className={item.queueStatus === "rejected" ? "text-rose-700" : "text-amber-800"}>{item.queueStatus === "rejected" ? "Đã từ chối" : "Đang chờ xác nhận"}</strong></div>)}</div></section>}
      {bill.status === "open" && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><Text.Title size="small">Menu quán</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Chọn món, cửa hàng sẽ xác nhận trước khi tính tiền.</Text></div><button disabled={!menu.length || Boolean(bill.billingPaused)} onClick={() => setMenuOpen(true)} className="min-h-10 shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">Gọi món</button></div></section>}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Text.Title size="small">Chi tiết</Text.Title><div className="mt-3 divide-y divide-slate-100">{bill.items.filter((item) => item.lineTotal > 0).map((item) => <div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><div className="min-w-0"><strong className="block break-words text-slate-900">{item.name}</strong><span className="text-slate-500">{item.quantity} {item.unitLabel || "lần"} × {money(item.unitPrice)}</span>{item.billingUnit === "quantity" && item.startedAt && <span className="mt-1 block text-xs text-slate-500">Đặt lúc {formatVietnamDateTime(item.startedAt)}</span>}</div><strong className="shrink-0 text-right">{money(item.lineTotal)}</strong></div>)}</div><div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-sm"><div className="flex justify-between"><span>Tạm tính</span><strong>{money(bill.grossAmount)}</strong></div><div className="flex justify-between"><span>Khuyến mại</span><strong>-{money(bill.discountAmount)}</strong></div><div className="flex justify-between text-base font-bold text-emerald-800"><span>Tổng thanh toán</span><strong>{money(bill.totalAmount)}</strong></div></div></section>
      {bill.status !== "paid" && bill.status !== "cancelled" && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"><Text.Title size="small">Thanh toán chuyển khoản</Text.Title>{otherPaymentPending ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Bill đang chờ cửa hàng duyệt thanh toán ví.</div> : <><Text size="small" className="block text-slate-600">{paymentPending ? `Đang chờ cửa hàng xác nhận đã nhận ${money(bill.requestedAmount)}.` : `Quét mã để chuyển ${money(bill.totalAmount)}.`}</Text>{qrUrl ? <img src={qrUrl} alt="Mã QR thanh toán hóa đơn" className="mx-auto aspect-square w-56 max-w-full rounded-lg border border-slate-200 bg-white object-contain" /> : <Text size="small" className="text-amber-800">Cửa hàng chưa cấu hình tài khoản nhận chuyển khoản.</Text>}{payment.accountNumber && <Text size="xSmall" className="block text-slate-600">{payment.accountName} · {payment.bankId} · {payment.accountNumber}</Text>}{paymentPending ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Yêu cầu đã gửi. Bill sẽ được cập nhật sau khi cửa hàng xác nhận.</div> : <>{bill.paymentError && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{bill.paymentError}</div>}<div className="grid grid-cols-2 gap-2"><button disabled={!qrUrl} onClick={() => void openBankPicker()} className="min-h-12 rounded-lg border border-emerald-700 px-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">Chuyển khoản</button><button disabled={busy || !qrUrl} onClick={() => void requestPayment()} className="min-h-12 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang gửi..." : "Tôi đã chuyển khoản"}</button></div></>}</>}</section>}
      <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><Icon icon="zi-lock" /> Chỉ người có đường link này mới xem được bill</div>
    </main>
    <Sheet visible={menuOpen} onClose={() => busy ? undefined : setMenuOpen(false)} autoHeight swipeToClose unmountOnClose>
      <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div><Text.Title size="small">Menu quán</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Món sẽ được tính vào bill sau khi staff hoặc admin duyệt.</Text></div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">{menu.map((product) => <div key={product.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-0 flex-1"><Text size="small" className="block break-words font-semibold text-slate-900">{product.name}</Text><Text size="xSmall" className="text-slate-500">{product.category} · {money(product.price)} / {product.unitLabel}</Text></div><input aria-label={`Số lượng ${product.name}`} type="number" min="0" step={product.billingUnit === "weight" ? "0.1" : "1"} value={quantities[product.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} className="h-10 w-20 rounded-md border border-slate-300 px-2 text-center text-sm" /></div>)}</div>
        <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => setMenuOpen(false)} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Đóng</button><button disabled={busy || !Object.values(quantities).some((quantity) => quantity > 0)} onClick={() => void requestOrder()} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Spinner /> : null}Gửi yêu cầu</button></div>
      </Box>
    </Sheet>
    <Sheet visible={bankPickerOpen} onClose={() => setBankPickerOpen(false)} autoHeight swipeToClose unmountOnClose>
      <Box className="max-h-[80vh] space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div className="flex items-center justify-between"><Text.Title size="small">Chọn ứng dụng ngân hàng</Text.Title><button aria-label="Đóng danh sách ngân hàng" onClick={() => setBankPickerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
        {bankAppsLoading ? <div className="flex justify-center py-8"><Spinner /></div> : bankApps.map((app) => <button key={app.appId} type="button" onClick={() => selectBankApp(app.appId)} className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-slate-100">{app.appLogo ? <img src={app.appLogo} alt="" className="h-full w-full object-cover" /> : <Icon icon="zi-wallet" />}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{app.appName}</span><Icon icon="zi-chevron-right" className="text-slate-400" /></button>)}
      </Box>
    </Sheet>
  </Page>;
}

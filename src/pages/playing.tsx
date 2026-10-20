import { useEffect, useMemo, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GiEightBall } from "react-icons/gi";

import { tableBillingService, walletService } from "@/api/services";
import type { TableBill, TableBillProduct, WalletOrder } from "@/api/pocketbase";
import { useAuth } from "@/contexts/AuthContext";

const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;
const quantityText = (value: number, unit: TableBill["items"][number]["billingUnit"]) => unit === "quantity" ? String(Math.round(value)) : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const errorMessage = (error: any) => error?.response?.data?.error || error?.response?.message || error?.message || "Không thể thực hiện thao tác";
const draftsFor = (items: TableBill["items"]) => items.reduce<Record<string, string>>((drafts, item) => { drafts[item.id] = String(item.quantity); return drafts; }, {});

export default function PlayingPage() {
  const { tableId, billId } = useParams<{ tableId?: string; billId?: string }>();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [bill, setBill] = useState<TableBill | null>(null);
  const [products, setProducts] = useState<TableBillProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [quantityDraft, setQuantityDraft] = useState<Record<string, string>>({});
  const [paymentDone, setPaymentDone] = useState<{ promoUsed?: number; mainUsed?: number } | null>(null);
  const [legacyOrder, setLegacyOrder] = useState<WalletOrder | null>(null);
  const [legacyOrderError, setLegacyOrderError] = useState("");

  const loadBill = async () => {
    try {
      const result = billId ? await tableBillingService.getDetail(billId) : tableId ? await tableBillingService.getByTable(tableId) : null;
      if (!result) { navigate("/", { replace: true }); return; }
      setBill(result);
      setQuantityDraft(draftsFor(result.items));
    } catch (error) {
      openSnackbar({ text: errorMessage(error) || "Không thể tải hóa đơn", type: "error" });
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const loadLegacyOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    setLegacyOrderError("");
    try {
      setLegacyOrder(await walletService.getOrder(orderId));
    } catch (error) {
      setLegacyOrderError(errorMessage(error) || "Không thể tải hóa đơn ví cũ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadLegacyOrder();
      return;
    }
    loadBill();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadBill();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [billId, tableId, orderId]);

  useEffect(() => {
    if (!catalogOpen || !isAdmin) return;
    tableBillingService.getProducts().then((result) => setProducts(result.items)).catch((error) => openSnackbar({ text: errorMessage(error), type: "error" }));
  }, [catalogOpen, isAdmin]);

  const categories = useMemo(() => ["Tất cả", ...Array.from(new Set(products.map((product) => product.category || "Khác"))).sort((a, b) => a.localeCompare(b, "vi"))], [products]);
  const visibleProducts = useMemo(() => activeCategory === "Tất cả" ? products : products.filter((product) => (product.category || "Khác") === activeCategory), [activeCategory, products]);
  const isOpen = bill?.status === "open";
  const isWalletPending = bill?.status === "wallet_pending";

  const refresh = async () => {
    if (!bill) return;
    const result = await tableBillingService.getDetail(bill.id);
    setBill(result);
    setQuantityDraft(draftsFor(result.items));
  };

  const addProduct = async (product: TableBillProduct) => {
    if (!bill) return;
    const value = Number(quantityDraft[`product:${product.id}`] || 1);
    if (product.billingUnit !== "hour" && (!Number.isFinite(value) || value <= 0 || (product.billingUnit === "quantity" && !Number.isInteger(value)))) {
      openSnackbar({ text: product.billingUnit === "quantity" ? "Số lượng phải là số nguyên dương" : "Trọng lượng phải lớn hơn 0", type: "warning" });
      return;
    }
    setBusy(true);
    try {
      const response = await tableBillingService.addItem(bill.id, product.id, value);
      setBill(response.bill);
      setQuantityDraft(draftsFor(response.bill.items));
      openSnackbar({ text: product.billingUnit === "hour" ? "Đã bắt đầu tính giờ" : "Đã thêm vào hóa đơn", type: "success" });
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const updateQuantity = async (itemId: string) => {
    if (!bill) return;
    const quantity = Number(quantityDraft[itemId]);
    const item = bill.items.find((line) => line.id === itemId);
    if (!item || !Number.isFinite(quantity) || quantity <= 0 || (item.billingUnit === "quantity" && !Number.isInteger(quantity))) return;
    if (quantity === item.quantity) return;
    setBusy(true);
    try {
      const response = await tableBillingService.updateItem(bill.id, itemId, quantity);
      setBill(response.bill);
      setQuantityDraft(draftsFor(response.bill.items));
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!bill || !window.confirm("Xóa dòng hàng này khỏi hóa đơn?")) return;
    setBusy(true);
    try {
      const response = await tableBillingService.deleteItem(bill.id, itemId);
      setBill(response.bill);
      setQuantityDraft(draftsFor(response.bill.items));
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const requestWallet = async () => {
    if (!bill) return;
    setBusy(true);
    try {
      const result = await tableBillingService.requestWallet(bill.id);
      setBill(result.bill);
      openSnackbar({ text: result.alreadyRequested ? "Yêu cầu thanh toán đang chờ admin duyệt" : "Đã gửi yêu cầu thanh toán ví", type: "success" });
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const payManual = async (method: "cash" | "transfer") => {
    if (!bill) return;
    setBusy(true);
    try {
      const result = await tableBillingService.payManual(bill.id, method);
      setBill(result.bill);
      openSnackbar({ text: method === "cash" ? "Đã ghi nhận thanh toán tiền mặt" : "Đã ghi nhận chuyển khoản", type: "success" });
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const approveWallet = async () => {
    if (!bill) return;
    setBusy(true);
    try {
      const result = await tableBillingService.approveWallet(bill.id);
      setBill(result.bill);
      if (!result.ok) openSnackbar({ text: result.error || "Thanh toán ví thất bại", type: "error" });
      else {
        setPaymentDone({ promoUsed: result.promoUsed, mainUsed: result.mainUsed });
        openSnackbar({ text: result.alreadyPaid ? "Hóa đơn đã được thanh toán" : "Đã duyệt thanh toán ví", type: "success" });
      }
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const payLegacyOrder = async () => {
    if (!orderId || !legacyOrder) return;
    setBusy(true);
    try {
      await walletService.payOrder(orderId, `pay-${orderId}`);
      setLegacyOrder(await walletService.getOrder(orderId));
      openSnackbar({ text: "Đã thanh toán hóa đơn bằng ví", type: "success" });
    } catch (error) {
      openSnackbar({ text: errorMessage(error) || "Không thể thanh toán bằng ví", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Page className="min-h-screen bg-slate-50"><div className="flex justify-center py-16"><Spinner /></div></Page>;
  if (orderId) return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 pb-3 pt-12"><button aria-label="Quay lại" title="Quay lại" onClick={() => navigate(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon icon="zi-arrow-left" /></button><Text.Title size="small" className="flex-1">Thanh toán hóa đơn</Text.Title></header>
    <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
      {legacyOrderError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{legacyOrderError}<button onClick={loadLegacyOrder} className="mt-3 block font-semibold underline">Thử lại</button></div> : legacyOrder && <>
        <section className="space-y-3 border-b border-slate-200 pb-4"><Text size="small" className="text-slate-500">Mã hóa đơn</Text><Text className="break-all font-semibold text-slate-900">{legacyOrder.id}</Text>{legacyOrder.table && <Text size="small" className="text-slate-600">Bàn: {legacyOrder.table}</Text>}</section>
        <section className="flex items-center justify-between"><Text.Title size="small">Tổng cộng</Text.Title><Text.Title size="small" className="text-rose-700">{money(legacyOrder.totalAmount)}</Text.Title></section>
        {legacyOrder.status === "paid" ? <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">Hóa đơn đã thanh toán{legacyOrder.paymentMethod === "wallet" ? " bằng ví" : ""}.</div> : legacyOrder.status !== "unpaid" ? <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">Hóa đơn này không còn chờ thanh toán.</div> : <button disabled={busy} onClick={payLegacyOrder} className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : "Thanh toán bằng ví"}</button>}
      </>}
    </main>
  </Page>;
  if (!bill) return null;

  const billStatus = bill.status === "paid" ? "Đã thanh toán" : bill.status === "wallet_pending" ? "Chờ admin duyệt ví" : bill.status === "cancelled" ? "Đã hủy" : "Đang sử dụng";
  const unitText = (unit: TableBillProduct["billingUnit"]) => unit === "hour" ? "giờ" : unit === "weight" ? "kg" : "lần";

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+108px)]">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 pb-3 pt-12">
      <button aria-label="Quay lại sơ đồ bàn" title="Quay lại" onClick={() => navigate("/")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon icon="zi-arrow-left" /></button>
      <div className="min-w-0 flex-1"><Text.Title size="small" className="truncate text-slate-900">{bill.tableName}</Text.Title><Text size="xSmall" className="text-slate-500">Bắt đầu {new Date(bill.startedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</Text></div>
      <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${bill.status === "paid" ? "bg-emerald-100 text-emerald-800" : bill.status === "wallet_pending" ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-800"}`}>{billStatus}</span>
    </header>

    <main className="mx-auto max-w-4xl space-y-5 px-4 py-4">
      <section className="flex items-center gap-3 border-b border-slate-200 pb-4"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800"><GiEightBall size={27} /></div><div><Text size="small" className="font-semibold text-slate-900">{bill.tableName}</Text><Text size="xSmall" className="text-slate-500">{bill.customer ? "Đã gắn tài khoản khách" : "Hóa đơn chưa gắn tài khoản"}</Text></div></section>

      {isWalletPending && <div className={`rounded-lg border p-3 text-sm ${bill.paymentError ? "border-rose-300 bg-rose-50 text-rose-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{bill.paymentError || "Khách đã gửi yêu cầu thanh toán ví. Hóa đơn và bàn vẫn đang mở."}</div>}
      {bill.status === "paid" && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Đã thanh toán bằng {bill.paymentMethod === "cash" ? "tiền mặt" : bill.paymentMethod === "transfer" ? "chuyển khoản" : "ví"}{bill.paidAt ? ` lúc ${new Date(bill.paidAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}.</div>}

      <section>
        <div className="mb-2 flex items-center justify-between"><Text.Title size="small" className="text-slate-900">Chi tiết hóa đơn</Text.Title>{isAdmin && isOpen && <button onClick={() => setCatalogOpen(true)} className="flex min-h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white"><Icon icon="zi-plus" />Thêm mặt hàng</button>}</div>
        {bill.items.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">Chưa có mặt hàng trong hóa đơn</div> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">{bill.items.map((item) => <div key={item.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><Text size="small" className="font-medium text-slate-900">{item.name}</Text><Text size="xSmall" className="mt-1 block text-slate-500">{money(item.unitPrice)} / {item.unitLabel || unitText(item.billingUnit)}{item.billingUnit === "hour" ? ` · ${quantityText(item.quantity, item.billingUnit)} giờ` : ""}</Text></div>
          {isAdmin && isOpen && item.billingUnit !== "hour" ? <input aria-label={`Số lượng ${item.name}`} type="number" min="0.01" step={item.billingUnit === "quantity" ? 1 : 0.01} inputMode="decimal" value={quantityDraft[item.id] ?? String(item.quantity)} onChange={(event) => setQuantityDraft((current) => ({ ...current, [item.id]: event.target.value }))} onBlur={() => updateQuantity(item.id)} className="w-20 rounded-md border border-slate-300 px-2 py-2 text-right text-sm" /> : item.billingUnit !== "hour" ? <span className="text-sm text-slate-600">× {quantityText(item.quantity, item.billingUnit)} {item.unitLabel}</span> : null}
          <Text size="small" className="w-24 text-right font-semibold text-slate-900">{money(item.lineTotal)}</Text>
          {isAdmin && isOpen && <button aria-label={`Xóa ${item.name}`} title="Xóa dòng hàng" onClick={() => removeItem(item.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50"><Icon icon="zi-delete" /></button>}
        </div>)}</div>}
      </section>

      <section className="flex items-center justify-between border-t border-slate-200 pt-4"><Text.Title size="small" className="text-slate-900">Tổng cộng</Text.Title><Text.Title size="small" className="text-rose-700">{money(bill.totalAmount)}</Text.Title></section>
      {paymentDone && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Khuyến mại đã dùng {money(paymentDone.promoUsed || 0)}, tài khoản chính đã dùng {money(paymentDone.mainUsed || 0)}.</div>}

      {isAdmin && isWalletPending && <div className="flex flex-col gap-2 sm:flex-row"><button disabled={busy} onClick={approveWallet} className="min-h-12 flex-1 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : "Duyệt thanh toán ví"}</button><button disabled={busy} onClick={() => payManual("cash")} className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Ghi nhận tiền mặt</button><button disabled={busy} onClick={() => payManual("transfer")} className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Ghi nhận chuyển khoản</button></div>}
    </main>

    {isOpen && <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+64px)] z-10 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:bottom-0"><div className="mx-auto max-w-4xl">{isAdmin ? <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => payManual("cash")} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">Tiền mặt</button><button disabled={busy} onClick={() => payManual("transfer")} className="min-h-11 rounded-lg border border-emerald-700 px-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">Chuyển khoản</button></div> : <button disabled={busy || !bill.customer} onClick={requestWallet} className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang gửi yêu cầu..." : bill.customer ? "Yêu cầu thanh toán bằng ví" : "Hóa đơn chưa gắn tài khoản khách"}</button>}</div></div>}

    <Sheet visible={catalogOpen && isAdmin && isOpen} onClose={() => setCatalogOpen(false)} autoHeight swipeToClose>
      <Box className="max-h-[85vh] space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div className="flex items-center justify-between"><Text.Title size="small">Thêm mặt hàng</Text.Title><button aria-label="Đóng" onClick={() => setCatalogOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${activeCategory === category ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{category}</button>)}</div>
        {visibleProducts.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Chưa có mặt hàng trong danh mục</div> : <div className="divide-y divide-slate-200">{visibleProducts.map((product) => <div key={product.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><Text size="small" className="font-medium text-slate-900">{product.name}</Text><Text size="xSmall" className="text-slate-500">{money(product.price)} / {product.unitLabel || unitText(product.billingUnit)}</Text></div>{product.billingUnit !== "hour" && <input aria-label={`Số lượng ${product.name}`} type="number" min="0.01" step={product.billingUnit === "quantity" ? 1 : 0.01} inputMode="decimal" value={quantityDraft[`product:${product.id}`] || "1"} onChange={(event) => setQuantityDraft((current) => ({ ...current, [`product:${product.id}`]: event.target.value }))} className="w-20 rounded-md border border-slate-300 px-2 py-2 text-right text-sm" />}<button disabled={busy} aria-label={`Thêm ${product.name}`} title="Thêm vào hóa đơn" onClick={() => addProduct(product)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white disabled:opacity-50"><Icon icon="zi-plus" /></button></div>)}</div>}
      </Box>
    </Sheet>
  </Page>;
}

import { useEffect, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";

import { tableBillingService } from "@/api/services";
import type { StaffQueueItem } from "@/api/pocketbase";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffQueue } from "@/contexts/StaffQueueContext";
import { formatVietnamDateTime } from "@/utils/format";
import { groupOrderRequests, groupQueueItems, groupQueueItemsByProduct, type StaffQueueGroup } from "@/utils/staff-queue";

const messageOf = (error: any) => error?.response?.data?.error || error?.response?.message || error?.message || "Không thể cập nhật hàng chờ";
const dateTime = (value: string) => value ? formatVietnamDateTime(value) : "";

export default function StaffQueuePage() {
  const { user } = useAuth();
  const { revision, historyUnread, paymentUnread, requestUnread, markRequestsRead, markPaymentRead, markHistoryRead } = useStaffQueue();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [view, setView] = useState<"queue" | "requests" | "payments" | "history">("requests");
  const [queueMode, setQueueMode] = useState<"table" | "product">("table");
  const [items, setItems] = useState<StaffQueueItem[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [cancelGroup, setCancelGroup] = useState<StaffQueueGroup | null>(null);
  const canUse = user?.role === "admin" || user?.role === "staff";

  const load = async () => {
    setLoading(true);
    try {
      const [current, requests] = await Promise.all([
        view === "requests" ? tableBillingService.getOrderRequests() : view === "payments" ? tableBillingService.getPaymentRequests() : tableBillingService.getQueue(view === "history"),
        view === "requests" || view === "payments" ? Promise.resolve(null) : tableBillingService.getOrderRequests(),
      ]);
      setItems(current.items);
      setRequestCount(groupOrderRequests(requests?.items ?? current.items).length);
    }
    catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (canUse) void load(); }, [canUse, view, revision, user?.id, user?.store]);
  useEffect(() => { if (view === "requests") markRequestsRead(); }, [view, revision]);

  if (!canUse) return <Navigate to="/" replace />;

  const completeGroup = async (group: StaffQueueGroup) => {
    const itemIds = group.items.map((item) => item.id);
    setBusyId(group.id);
    try {
      await Promise.all(group.items.map((item) => tableBillingService.updateQueue(item.billId, item.id, "queue_done")));
      setItems((current) => current.filter((line) => !itemIds.includes(line.id)));
      openSnackbar({ text: "Đã hoàn thành các món trong đơn", type: "success", position: "top" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); void load(); }
    finally { setBusyId(""); }
  };

  const cancel = async () => {
    if (!cancelGroup) return;
    const itemIds = cancelGroup.items.map((item) => item.id);
    setBusyId(cancelGroup.id);
    try {
      await Promise.all(cancelGroup.items.map((item) => tableBillingService.updateQueue(item.billId, item.id, "queue_cancel")));
      setItems((current) => current.filter((line) => !itemIds.includes(line.id)));
      setCancelGroup(null);
      openSnackbar({ text: "Đã hủy các món trong đơn", type: "success", position: "top" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); void load(); }
    finally { setBusyId(""); }
  };

  const decideRequest = async (group: StaffQueueGroup, approve: boolean) => {
    const item = group.items[0];
    const itemIds = group.items.map((line) => line.id);
    setBusyId(group.id);
    try {
      await tableBillingService.updateOrderRequest(item.billId, itemIds, approve);
      setItems((current) => current.filter((line) => !itemIds.includes(line.id)));
      openSnackbar({ text: approve ? "Đã duyệt yêu cầu món" : "Đã từ chối yêu cầu món", type: "success", position: "top" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); void load(); }
    finally { setBusyId(""); }
  };

  const decidePayment = async (item: StaffQueueItem, received: boolean) => {
    setBusyId(item.id);
    try {
      if (received) await tableBillingService.payManual(item.billId, "transfer");
      else await tableBillingService.markTransferUnreceived(item.billId);
      setItems((current) => current.filter((line) => line.id !== item.id));
      openSnackbar({ text: received ? "Đã xác nhận thanh toán hóa đơn" : "Đã ghi nhận chưa nhận được tiền; bill vẫn chưa thanh toán", type: "success", position: "top" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); void load(); }
    finally { setBusyId(""); }
  };

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+92px)]">
    <StoreHeader />
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
      <header className="flex items-center gap-3">
        <button aria-label="Quay lại" title="Quay lại" onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm"><Icon icon="zi-arrow-left" /></button>
        <Text.Title size="small" className="min-w-0 flex-1 text-slate-900">Hàng chờ</Text.Title>
      </header>
      <div role="tablist" aria-label="Hàng chờ" className="grid grid-cols-4 rounded-lg border border-slate-200 bg-white p-1">
        {([["queue", "Chế biến"], ["requests", "Yêu cầu món"], ["payments", "Thanh toán"], ["history", "Lịch sử"]] as const).map(([key, label]) => <button key={key} role="tab" aria-label={key === "requests" && requestCount > 0 ? `${label}, ${requestCount} đơn chờ` : key === "payments" && paymentUnread ? `${label}, có yêu cầu mới` : key === "history" && historyUnread ? `${label}, có cập nhật mới` : label} aria-selected={view === key} onClick={() => { setView(key); if (key === "payments") markPaymentRead(); if (key === "history") markHistoryRead(); }} className={`relative min-h-11 rounded-md px-1 text-xs font-semibold ${view === key ? "bg-emerald-700 text-white" : "text-slate-600"}`}>
          {label}{key === "requests" && requestCount > 0 && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />}{key === "payments" && paymentUnread && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />}{key === "history" && historyUnread && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />}
        </button>)}
      </div>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : items.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">{view === "requests" ? "Chưa có yêu cầu món." : view === "payments" ? "Chưa có yêu cầu xác nhận thanh toán." : view === "history" ? "Chưa có lịch sử thao tác." : "Hiện chưa có món đang chờ."}</div> : view === "requests" ? <div className="space-y-3">
        {groupOrderRequests(items).map((group) => {
          const item = group.items[0];
          return <article key={group.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3"><Text size="small" className="min-w-0 flex-1 break-words font-semibold text-slate-900">{item.tableName}</Text><Text size="xSmall" className="shrink-0 text-right text-slate-500">{dateTime(item.queuedAt)}</Text></div>
            <div className="divide-y divide-slate-100 border-y border-slate-100">{group.items.map((line) => <div key={line.id} className="flex min-w-0 items-start justify-between gap-3 py-2"><Text size="small" className="min-w-0 flex-1 break-words text-slate-900">{line.name}</Text><Text size="xSmall" className="shrink-0 text-right text-slate-600">{line.quantity.toLocaleString("vi-VN")} {line.unitLabel}</Text></div>)}</div>
            <Text size="xSmall" className="block text-slate-500">Khách: {item.actorName}</Text>
            <div className="grid grid-cols-2 gap-2"><button disabled={busyId === group.id || group.items.some((line) => line.billStatus !== "open")} onClick={() => void decideRequest(group, true)} className="min-h-11 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">Duyệt</button><button disabled={busyId === group.id || group.items.some((line) => line.billStatus !== "open")} onClick={() => void decideRequest(group, false)} className="min-h-11 rounded-md border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 disabled:opacity-50">Từ chối</button></div>
          </article>;
        })}
      </div> : view === "queue" ? <div className="space-y-3">
        <div role="tablist" aria-label="Cách xem món chế biến" className="grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1">
          {([['table', 'Theo bàn'], ['product', 'Theo mặt hàng']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={queueMode === key} onClick={() => setQueueMode(key)} className={`min-h-10 rounded-md px-2 text-sm font-semibold ${queueMode === key ? 'bg-sky-700 text-white' : 'text-slate-600'}`}>{label}</button>)}
        </div>
        {queueMode === "product" ? <div className="space-y-3">
          {groupQueueItemsByProduct(items).map((group) => {
            const first = group.items[0];
            const total = group.items.reduce((sum, item) => sum + item.quantity, 0);
            return <article key={group.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3"><Text size="small" className="min-w-0 flex-1 break-words font-semibold text-slate-900">{first.name}</Text><Text size="small" className="shrink-0 font-bold text-sky-700">{total.toLocaleString("vi-VN")} {first.unitLabel}</Text></div>
              <div className="divide-y divide-slate-100 border-y border-slate-100">{group.items.map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-2"><Text size="small" className="min-w-0 flex-1 text-slate-700">{item.tableName}</Text><Text size="xSmall" className="shrink-0 text-slate-600">{item.quantity.toLocaleString("vi-VN")} {item.unitLabel}</Text></div>)}</div>
              <Text size="xSmall" className="block text-slate-500">Chỉ xem · {group.items.length} bàn</Text>
            </article>;
          })}
        </div> : <div className="space-y-3">
        {groupQueueItems(items).map((group) => {
          const first = group.items[0];
          return <article key={group.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3"><Text size="small" className="min-w-0 flex-1 break-words font-semibold text-slate-900">{first.tableName}</Text><Text size="xSmall" className="shrink-0 text-right text-slate-500">{dateTime(first.queuedAt)}</Text></div>
            <Text size="small" className="block break-words border-y border-slate-100 py-3 leading-6 text-slate-900">{group.items.map((line) => `${line.name}: ${line.quantity.toLocaleString("vi-VN")}`).join(", ")}</Text>
            <div className="grid grid-cols-2 gap-2"><button disabled={busyId === group.id || group.items.some((item) => item.billStatus !== "open")} onClick={() => void completeGroup(group)} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === group.id ? <Spinner /> : <Icon icon="zi-check" />}Hoàn thành</button><button disabled={busyId === group.id || group.items.some((item) => item.billStatus !== "open")} onClick={() => setCancelGroup(group)} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 disabled:opacity-50"><Icon icon="zi-close" />Hủy</button></div>
          </article>;
        })}
        </div>}
      </div> : <div className="space-y-3">
        {items.map((item) => <article key={item.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><Text size="small" className="break-words font-semibold text-slate-900">{item.name}</Text><Text size="xSmall" className="mt-1 block text-slate-600">{view === "payments" ? `${(item.amount || 0).toLocaleString("vi-VN")}đ · ${item.tableName}` : `${item.quantity.toLocaleString("vi-VN")} ${item.unitLabel} · ${item.tableName}`}</Text></div>
            <Text size="xSmall" className="shrink-0 text-right text-slate-500">{dateTime(view === "history" ? item.completedAt : item.queuedAt)}</Text>
          </div>
          {view === "payments" ? <><Text size="xSmall" className="block text-slate-500">{item.actorName}</Text><div className="grid grid-cols-2 gap-2"><button disabled={busyId === item.id} onClick={() => void decidePayment(item, true)} className="min-h-11 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === item.id ? "Đang xử lý..." : "Đã nhận tiền"}</button><button disabled={busyId === item.id} onClick={() => void decidePayment(item, false)} className="min-h-11 rounded-md border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 disabled:opacity-50">Chưa nhận</button></div></> : <Text size="xSmall" className="block text-slate-500">{item.actionLabel || "Đã xử lý"}{item.actorName ? ` bởi ${item.actorName}` : ""}</Text>}
        </article>)}
      </div>}
    </main>
    <Sheet visible={Boolean(cancelGroup)} onClose={() => busyId ? undefined : setCancelGroup(null)} autoHeight swipeToClose unmountOnClose>
      {cancelGroup && <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div><Text.Title size="small">Xác nhận hủy đơn</Text.Title><Text size="small" className="mt-2 block text-slate-600">{cancelGroup.items.map((item) => `${item.name} · ${item.quantity.toLocaleString("vi-VN")} ${item.unitLabel}`).join(", ")} tại {cancelGroup.items[0].tableName}</Text><Text size="xSmall" className="mt-2 block text-rose-700">Các món sẽ không còn tính vào hóa đơn và tồn kho.</Text></div>
        <div className="grid grid-cols-2 gap-2"><button disabled={Boolean(busyId)} onClick={() => setCancelGroup(null)} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Quay lại</button><button disabled={Boolean(busyId)} onClick={() => void cancel()} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busyId ? <Spinner /> : null}Xác nhận hủy</button></div>
      </Box>}
    </Sheet>
  </Page>;
}

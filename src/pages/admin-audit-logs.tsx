import { useCallback, useEffect, useState } from "react";
import { Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { auditLogService, staffAdminService } from "@/api/services";
import type { AuditLog, StaffAccount } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";
import { formatVietnamDateTime, fromVietnamDateTimeInput, toVietnamDateTimeInput } from "@/utils/format";

const localNow = () => toVietnamDateTimeInput(new Date().toISOString());
const startOfToday = () => `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}T00:00`;
const messageOf = (error: any) => error?.response?.message || error?.message || "Không thể tải lịch sử thao tác";
const actionLabel: Record<string, string> = { create: "Tạo mới", update: "Chỉnh sửa", delete: "Xóa", update_item: "Sửa mặt hàng", update_item_time: "Sửa thời gian", delete_item: "Xóa mặt hàng", add_item: "Thêm mặt hàng", split_bill: "Tách bill", split_session: "Tách phiên", merge_bills: "Gộp bill", transfer_table: "Chuyển bàn", pay_manual: "Thanh toán", approve_wallet: "Duyệt thanh toán ví", request_wallet: "Yêu cầu thanh toán ví", request_transfer: "Yêu cầu chuyển khoản", queue_done: "Hoàn thành món", queue_cancel: "Hủy món" };

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [from, setFrom] = useState(startOfToday());
  const [to, setTo] = useState(localNow());
  const [actor, setActor] = useState("");
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const load = useCallback(async () => {
    if (from > to) { openSnackbar({ text: "Thời điểm bắt đầu không được sau thời điểm kết thúc", type: "warning" }); return; }
    setLoading(true);
    try { const result = await auditLogService.list({ from: fromVietnamDateTimeInput(from), to: fromVietnamDateTimeInput(to), actor }); setLogs(result.items); }
    catch (error) { openSnackbar({ text: messageOf(error), type: "error" }); }
    finally { setLoading(false); }
  }, [from, to, actor, openSnackbar]);

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/", { replace: true }); return; }
    void load();
    void staffAdminService.list().then((result) => setStaff(result.items.filter((item) => item.role === "staff"))).catch(() => {}).finally(() => setLoadingStaff(false));
    // Chỉ tải lần đầu; thay đổi bộ lọc chỉ áp dụng khi bấm nút tìm kiếm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, navigate]);

  if (user?.role !== "admin") return null;
  return <Page className="min-h-screen bg-slate-50 pb-8"><StoreHeader /><AdminNav /><main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
    <header><Text.Title size="small" className="text-slate-900">Lịch sử thao tác</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Theo dõi các thao tác tạo, chỉnh sửa và xóa của nhân viên</Text></header>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Từ thời điểm<input required type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label><label className="text-sm font-medium text-slate-700">Đến thời điểm<input required type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label></div>
      <label className="block text-sm font-medium text-slate-700">Nhân viên<select value={actor} onChange={(event) => setActor(event.target.value)} disabled={loadingStaff} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"><option value="">Tất cả nhân viên</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.fullname || item.username}</option>)}</select></label>
      <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{loading && <Spinner />}Xem lịch sử</button>
    </form>
    {loading ? <div className="flex justify-center py-12"><Spinner /></div> : logs.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có thao tác trong khoảng thời gian đã chọn.</div> : <section className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">{logs.map((log) => <article key={log.id} className="flex items-start gap-3 px-3 py-3"><div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon icon="zi-list-1" /></div><div className="min-w-0 flex-1"><Text size="small" className="font-semibold text-slate-900">{actionLabel[log.action] || log.action} · {log.collection}</Text><Text size="xSmall" className="mt-1 block text-slate-500">{formatVietnamDateTime(log.created)} · {log.expand?.actor?.fullname || log.expand?.actor?.username || "Nhân viên"}</Text>{log.record_id && <Text size="xSmall" className="mt-1 block break-all text-slate-600">Mã bản ghi: {log.record_id}</Text>}</div></article>)}</section>}
  </main></Page>;
}

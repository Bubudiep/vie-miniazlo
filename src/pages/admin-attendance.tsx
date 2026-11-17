import { useEffect, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";

import { staffAttendanceService } from "@/api/services";
import type { StaffAccount, StaffAttendance } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";
import { formatVietnamDate } from "@/utils/format";

type AttendanceRow = StaffAccount & { attendance: StaffAttendance | null };
type Draft = { staff: StaffAccount; status: 'present' | 'absent'; checkIn: string; checkOut: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const messageOf = (error: any) => error?.response?.data?.error || error?.response?.message || error?.message || "Không thể tải bảng chấm công";

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [workDate, setWorkDate] = useState(today);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRows((await staffAttendanceService.list(workDate)).items); }
    catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === "admin") void load(); }, [user?.role, workDate]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const attendance = await staffAttendanceService.save({
        staff: draft.staff.id,
        workDate,
        status: draft.status,
        checkIn: draft.status === "present" ? draft.checkIn : "",
        checkOut: draft.status === "present" ? draft.checkOut : "",
      });
      setRows((current) => current.map((row) => row.id === attendance.staff ? { ...row, attendance } : row));
      setDraft(null);
      openSnackbar({ text: "Đã lưu chấm công", type: "success", position: "top" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setSaving(false); }
  };

  if (user?.role !== "admin") return <Navigate to="/" replace />;
  const presentCount = rows.filter((row) => row.attendance?.status === "present").length;
  const absentCount = rows.filter((row) => row.attendance?.status === "absent").length;

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
      <header className="flex items-start gap-3">
        <button aria-label="Quay lại quản trị" onClick={() => navigate("/admin")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700"><Icon icon="zi-arrow-left" /></button>
        <div className="min-w-0 flex-1"><Text.Title size="small" className="text-slate-900">Chấm công nhân viên</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">{presentCount} đi làm · {absentCount} nghỉ · {rows.length - presentCount - absentCount} chưa chấm</Text></div>
      </header>
      <label className="block space-y-1"><span className="text-xs font-semibold text-slate-600">Ngày chấm công</span><input aria-label="Ngày chấm công" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900" /></label>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : rows.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">Chưa có nhân viên trong cửa hàng.</div> : <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">{rows.map((row) => {
        const attendance = row.attendance;
        const marked = attendance?.status;
        return <article key={row.id} className="flex items-center gap-3 p-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${marked === "present" ? "bg-emerald-100 text-emerald-800" : marked === "absent" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}><Icon icon="zi-user" /></div>
          <div className="min-w-0 flex-1"><Text size="small" className="truncate font-semibold text-slate-900">{row.fullname || row.username}</Text><div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span>{marked === "present" ? "Đi làm" : marked === "absent" ? "Nghỉ" : "Chưa chấm"}</span>{marked === "present" && <span>{attendance?.checkIn || "--:--"} – {attendance?.checkOut || "--:--"}</span>}</div></div>
          <button type="button" aria-label={`Chấm công ${row.fullname || row.username}`} onClick={() => setDraft({ staff: row, status: attendance?.status || "present", checkIn: attendance?.checkIn || "", checkOut: attendance?.checkOut || "" })} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-emerald-800" title="Sửa chấm công"><Icon icon="zi-edit" /></button>
        </article>;
      })}</div>}
    </main>
    <Sheet visible={Boolean(draft)} onClose={() => !saving && setDraft(null)} autoHeight swipeToClose unmountOnClose>
      <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div><Text.Title size="small">Ghi nhận chấm công</Text.Title><Text size="small" className="mt-1 block text-slate-600">{draft?.staff.fullname || draft?.staff.username} · {workDate}</Text></div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Trạng thái chấm công">
          {([["present", "Đi làm"], ["absent", "Nghỉ"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={draft?.status === value} onClick={() => setDraft((current) => current ? { ...current, status: value } : current)} className={`min-h-11 rounded-lg border text-sm font-semibold ${draft?.status === value ? value === "present" ? "border-emerald-700 bg-emerald-700 text-white" : "border-rose-700 bg-rose-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{label}</button>)}
        </div>
        {draft?.status === "present" && <div className="grid grid-cols-2 gap-3"><label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Giờ vào</span><input type="time" value={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkIn: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base" /></label><label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Giờ ra</span><input type="time" value={draft.checkOut} onChange={(event) => setDraft({ ...draft, checkOut: event.target.value })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base" /></label></div>}
        <div className="grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => setDraft(null)} className="min-h-11 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700">Hủy</button><button disabled={saving} onClick={() => void save()} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu chấm công"}</button></div>
      </Box>
    </Sheet>
  </Page>;
}

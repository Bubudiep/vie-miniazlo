import { useEffect, useMemo, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { Navigate, useNavigate } from "react-router-dom";

import { staffAdminService } from "@/api/services";
import type { StaffAccount } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";

type Change = { account: StaffAccount; type: "grant" | "revoke" | "lock" | "unlock" };
const messageOf = (error: any) => error?.response?.data?.error || error?.response?.message || error?.message || "Không thể cập nhật nhân viên";

export default function AdminStaffPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [change, setChange] = useState<Change | null>(null);

  const load = async (search = query) => {
    setLoading(true);
    try { setAccounts((await staffAdminService.list(search.trim())).items); }
    catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === "admin") void load(""); }, [user?.role]);
  const staffCount = useMemo(() => accounts.filter((account) => account.role === "staff").length, [accounts]);

  const confirm = async () => {
    if (!change) return;
    const { account, type } = change;
    setSaving(true);
    try {
      const input = type === "grant" ? { role: "staff" as const } : type === "revoke" ? { role: "user" as const } : { locked: type === "lock" };
      const result = await staffAdminService.update(account.id, input);
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, role: result.role, locked: result.locked } : item));
      setChange(null);
      openSnackbar({ text: type === "grant" ? "Đã cấp quyền nhân viên" : type === "revoke" ? "Đã thu hồi quyền nhân viên" : type === "lock" ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản", type: "success", position: "top" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setSaving(false); }
  };

  if (user?.role !== "admin") return <Navigate to="/" replace />;
  const title = change?.type === "grant" ? "Cấp quyền nhân viên" : change?.type === "revoke" ? "Thu hồi quyền nhân viên" : change?.type === "lock" ? "Khóa tài khoản" : "Mở khóa tài khoản";
  const detail = change?.type === "grant" ? "Tài khoản sẽ được thao tác bill, thu tiền mặt/chuyển khoản và in bill." : change?.type === "revoke" ? "Tài khoản sẽ trở về vai trò khách hàng và không còn vận hành bill." : change?.type === "lock" ? "Tài khoản sẽ không thể đăng nhập cho đến khi được mở khóa." : "Tài khoản có thể đăng nhập lại theo quyền hiện tại.";

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
      <header className="flex items-start gap-3"><button aria-label="Quay lại quản trị" onClick={() => navigate("/admin/settings")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700"><Icon icon="zi-arrow-left" /></button><div><Text.Title size="small" className="text-slate-900">Quản lý nhân viên</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">{staffCount} nhân viên trong kết quả hiện tại · chỉ tài khoản đã duyệt mới được cấp quyền</Text></div></header>
      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, username hoặc số điện thoại" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base" /><button type="submit" aria-label="Tìm nhân viên" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white"><Icon icon="zi-search" /></button></form>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : accounts.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">Không tìm thấy tài khoản phù hợp.</div> : <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">{accounts.map((account) => <article key={account.id} className="space-y-3 p-3"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Icon icon="zi-user" /></div><div className="min-w-0 flex-1"><Text size="small" className="truncate font-semibold text-slate-900">{account.fullname || account.username}</Text><Text size="xSmall" className="mt-1 block text-slate-500">@{account.username}{account.phone ? ` · ${account.phone}` : ""}</Text><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${account.role === "admin" ? "bg-amber-100 text-amber-800" : account.role === "staff" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{account.role === "admin" ? "Admin" : account.role === "staff" ? "Nhân viên" : "Khách hàng"}</span>{!account.approved && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Chờ duyệt</span>}{account.locked && <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-800">Đã khóa</span>}</div></div></div>{account.role !== "admin" && <div className="grid grid-cols-2 gap-2"><button disabled={!account.approved || saving} onClick={() => setChange({ account, type: account.role === "staff" ? "revoke" : "grant" })} className="min-h-10 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">{account.role === "staff" ? "Thu hồi staff" : "Cấp staff"}</button><button disabled={saving} onClick={() => setChange({ account, type: account.locked ? "unlock" : "lock" })} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${account.locked ? "border-emerald-300 text-emerald-800" : "border-rose-300 text-rose-700"}`}>{account.locked ? "Mở khóa" : "Khóa tài khoản"}</button></div>}</article>)}</div>}
    </main>
    <Sheet visible={Boolean(change)} onClose={() => !saving && setChange(null)} autoHeight swipeToClose unmountOnClose><Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4"><div><Text.Title size="small">{title}</Text.Title><Text size="small" className="mt-2 block text-slate-600">{change?.account.fullname || change?.account.username}</Text></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{detail}</div><div className="grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => setChange(null)} className="min-h-11 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700">Hủy</button><button disabled={saving} onClick={() => void confirm()} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Xác nhận"}</button></div></Box></Sheet>
  </Page>;
}

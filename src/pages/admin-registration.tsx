import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Text } from 'zmp-ui';
import { useAuth } from '@/contexts/AuthContext';
import { registrationAdminService } from '@/api/services';

type PendingUser = { id: string; username: string; fullname: string; phone: string };

export default function AdminRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const result = await registrationAdminService.get();
      setApprovalRequired(result.approvalRequired);
      setUsers(result.users);
      setError('');
    } catch {
      setError('Không thể tải danh sách tài khoản chờ duyệt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.role === 'admin') void load(); }, [user?.id]);

  const updateSetting = async (value: boolean) => {
    setSaving(true);
    try {
      await registrationAdminService.setApprovalRequired(value);
      setApprovalRequired(value);
      setMessage(value ? 'Đã bật phê duyệt tài khoản mới.' : 'Đã tắt phê duyệt tài khoản mới.');
      setError('');
    } catch {
      setError('Không thể cập nhật chế độ phê duyệt.');
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: string) => {
    setSaving(true);
    try {
      await registrationAdminService.approve(id);
      setUsers((current) => current.filter((item) => item.id !== id));
      setMessage('Đã phê duyệt tài khoản.');
      setError('');
    } catch {
      setError('Không thể phê duyệt tài khoản này.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') return <Page><p>Chỉ admin cửa hàng được quản lý tài khoản.</p></Page>;
  return (
    <Page className="min-h-screen bg-slate-50 px-4 pb-24 pt-12 dark:bg-black">
      <header className="flex items-center gap-3 pb-5">
        <button type="button" onClick={() => navigate('/account')} className="rounded-lg border px-3 py-2">Quay lại</button>
        <Text.Title size="small">Duyệt tài khoản</Text.Title>
      </header>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-green-700">{message}</p>}
      {loading ? <p>Đang tải...</p> : <>
        <label className="flex items-center justify-between rounded-xl bg-white p-4 dark:bg-zinc-900">
          <span>Yêu cầu duyệt tài khoản mới</span>
          <input type="checkbox" checked={approvalRequired} disabled={saving} onChange={(event) => void updateSetting(event.target.checked)} />
        </label>
        <p className="mt-2 text-sm text-slate-500">Khi tắt, người dùng đăng ký vào cửa hàng có thể đăng nhập ngay. Khi bật, tài khoản mới cần được duyệt bên dưới.</p>
        <h2 className="mt-6 font-semibold">Đang chờ duyệt ({users.length})</h2>
        <div className="mt-3 space-y-3">
          {users.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 dark:bg-zinc-900">
            <div className="min-w-0"><p className="font-medium">{item.fullname ? `${item.fullname} (${item.username})` : item.username}</p><p className="text-sm text-slate-500">{item.phone}</p></div>
            <button type="button" disabled={saving} onClick={() => void approve(item.id)} className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-white disabled:opacity-50">Duyệt</button>
          </div>)}
          {users.length === 0 && <p className="text-sm text-slate-500">Không có tài khoản chờ duyệt.</p>}
        </div>
      </>}
    </Page>
  );
}

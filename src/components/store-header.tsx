import { TbRosetteDiscountCheckFilled } from 'react-icons/tb';
import { FiSettings } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/images/logo.png';

export default function StoreHeader({ onSettings }: { onSettings?: () => void }) {
  const { storeId, storeName, storeNameStatus, user } = useAuth();
  const storeLabel = storeName ?? (
    storeNameStatus === 'loading'
      ? 'Đang tải cửa hàng...'
      : storeNameStatus === 'error'
        ? 'Không tải được tên cửa hàng'
        : storeId
          ? 'Không tìm thấy cửa hàng'
          : 'Chưa gắn cửa hàng'
  );

  return (
    <div className="sticky top-0 z-10 flex w-full items-center gap-2 rounded-b-2xl border-b border-orange-100 bg-white/90 px-4 pb-2 pt-11 shadow-sm backdrop-blur-md">
      <img src={logo} alt="Logo H2 Billiards" className="h-10 w-10 shrink-0 rounded-lg shadow-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[20px] font-semibold leading-tight text-slate-900">
          <span>H2 Billiards</span>
          <TbRosetteDiscountCheckFilled className="shrink-0 text-orange-500" size={15} aria-hidden="true" />
        </div>
        <div className="break-words text-[13px] text-slate-600">
          {storeLabel}
        </div>
      </div>
      {onSettings && user?.role === 'admin' && (
        <button
          type="button"
          onClick={onSettings}
          aria-label="Cài đặt sơ đồ bàn"
          title="Cài đặt sơ đồ bàn"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 active:bg-slate-100"
        >
          <FiSettings size={19} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

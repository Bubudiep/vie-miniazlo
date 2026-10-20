import { useEffect, useState } from "react";
import { Avatar, Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { walletService } from "@/api/services";
import type { WalletSummary } from "@/api/pocketbase";

const PAGE_CLASS =
  "flex flex-col bg-white pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black";

function AccountPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();

  useEffect(() => {
    if (isAuthenticated) walletService.getMine().then(setWallet).catch(() => setWallet(null));
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    openSnackbar({
      text: "Đã đăng xuất",
      type: "success",
      position: "top",
    });
    navigate("/login");
  };

  if (isLoading) {
    return (
      <Page className={PAGE_CLASS + " items-center justify-center"}>
        <Spinner />
      </Page>
    );
  }

  if (!isAuthenticated || !user) {
    navigate("/login");
    return null;
  }

  return (
    <Page className={PAGE_CLASS}>
      <div className="flex items-start gap-3 px-4 py-4 pt-12 border-b border-black/5 dark:border-white/10">
        <Avatar size={64}>
          {user.username.charAt(0).toUpperCase()}
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Text.Title size="small" className="truncate">
            {user.fullname || user.username}
          </Text.Title>
          {user.email && (
            <Text
              size="xSmall"
              className="truncate text-[#767a7f] dark:text-[#8f9499]"
            >
              {user.email}
            </Text>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            {user.role === "admin" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e8ba02]/15 px-2 py-1 text-[11px] font-semibold text-[#8a6d00] dark:bg-[#e8ba02]/20 dark:text-[#e8ba02]">
                <Icon icon="zi-star-solid" size={12} />
                Admin
              </span>
            )}
            {user.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-400">
                <Icon icon="zi-check-circle-solid" size={12} />
                Đã xác thực
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Đăng xuất"
          className="flex shrink-0 items-center gap-1 py-1 text-red-500"
        >
          <Icon icon="zi-leave" />
          <Text size="xSmall">Đăng xuất</Text>
        </button>
      </div>

      <div className="flex-1">
        <div className="px-4 py-4">
          <Text.Title size="small">Thông tin tài khoản</Text.Title>

          <div className="mt-4 space-y-3">
            <button type="button" onClick={() => navigate("/account/wallet")} className="w-full rounded-2xl bg-slate-50 p-4 text-left dark:bg-white/10">
              <div className="flex items-center justify-between"><Text size="small">Tài khoản chính</Text><Text size="small" className="font-semibold text-green-600">{(wallet?.mainBalance || 0).toLocaleString("vi-VN")}đ</Text></div>
              <div className="mt-3 flex items-center justify-between"><Text size="small">Tài khoản khuyến mại</Text><Text size="small" className="font-semibold text-orange-500">{(wallet?.promoBalance || 0).toLocaleString("vi-VN")}đ</Text></div>
              <Text size="xSmall" className="mt-3 block text-[#767a7f]">Chạm để xem chi tiết và lịch sử</Text>
            </button>
            <button type="button" onClick={() => navigate("/account/xu")} className="flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-950/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Icon icon="zi-star-solid" /></span>
              <span className="min-w-0 flex-1"><Text size="small" className="font-semibold">Xu thưởng</Text><Text size="xSmall" className="mt-1 block text-slate-600 dark:text-slate-300">Điểm danh, giới thiệu bạn bè và đổi quà</Text></span>
              <Icon icon="zi-chevron-right" className="shrink-0 text-slate-500" />
            </button>
            <div className="flex items-center justify-between py-3 border-b border-black/5 dark:border-white/10">
              <Text size="small" className="text-[#767a7f] dark:text-[#8f9499]">
                Tên đăng nhập
              </Text>
              <Text size="small">{user.username}</Text>
            </div>

            {user.phone && (
              <div className="flex items-center justify-between py-3 border-b border-black/5 dark:border-white/10">
                <Text size="small" className="text-[#767a7f] dark:text-[#8f9499]">Số điện thoại</Text>
                <Text size="small">{user.phone}</Text>
              </div>
            )}

            {user.email && (
              <div className="flex items-center justify-between py-3 border-b border-black/5 dark:border-white/10">
                <Text size="small" className="text-[#767a7f] dark:text-[#8f9499]">
                  Email
                </Text>
                <Text size="small">{user.email}</Text>
              </div>
            )}

            <div className="flex items-center justify-between py-3 border-b border-black/5 dark:border-white/10">
              <Text size="small" className="text-[#767a7f] dark:text-[#8f9499]">
                Vai trò
              </Text>
              <Text size="small" className="capitalize">
                {user.role || "user"}
              </Text>
            </div>

          </div>
          {user.role === "admin" && <button type="button" onClick={() => navigate("/admin/registration")} className="mt-4 flex w-full items-center justify-between rounded-lg border border-green-200 px-4 py-3 text-left text-green-700"><span>Duyệt tài khoản</span><Icon icon="zi-arrow-right" /></button>}
          {user.role === "admin" && <button type="button" onClick={() => navigate("/admin/wallets")} className="mt-4 flex w-full items-center justify-between rounded-xl border border-green-200 px-4 py-3 text-left text-green-700"><span>Quản lý ví user</span><Icon icon="zi-arrow-right" /></button>}
          {user.role === "admin" && <button type="button" onClick={() => navigate("/admin/xu")} className="mt-3 flex w-full items-center justify-between rounded-lg border border-amber-200 px-4 py-3 text-left text-amber-800"><span>Quản lý Xu</span><Icon icon="zi-arrow-right" /></button>}
        </div>
      </div>

    </Page>
  );
}

export default AccountPage;

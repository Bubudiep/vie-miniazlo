import { useEffect, useState } from "react";
import { getUserInfo } from "zmp-sdk";
import { Avatar, Icon, Page, Spinner, Text, useSnackbar } from "zmp-ui";
import type { IconString } from "zmp-ui/icon";
import { GiEightBall } from "react-icons/gi";
import { SiZalo } from "react-icons/si";

import { accountStats, notifications } from "@/mock/account";
import MemberCard from "@/components/memberCard";
import {
  AuthState,
  loginWithPhone,
  loginWithZalo,
  logout,
  useAuth,
} from "@/state/auth";

type MemberState = Extract<AuthState, { status: "member" }>;

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

const PAGE_CLASS =
  "flex flex-col bg-white pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black";

const BENEFITS: {
  icon: keyof typeof IconString;
  title: string;
  text: string;
}[] = [
  {
    icon: "zi-clock-1",
    title: "Tặng 30 phút chơi",
    text: "Miễn phí cho hội viên mới đăng ký",
  },
  {
    icon: "zi-star",
    title: "Tích điểm mỗi lần chơi",
    text: "Đổi điểm thưởng lấy phút chơi",
  },
  {
    icon: "zi-calendar",
    title: "Đặt bàn trước",
    text: "Giữ bàn và theo dõi giờ chơi ngay trên Zalo",
  },
];

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof IconString;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-center">
      <Icon icon={icon} className="text-[#006af5] dark:text-[#52a0ff]" />
      <Text bold size="normal">
        {value}
      </Text>
      <Text size="xxSmall" className="text-[#767a7f] dark:text-[#8f9499]">
        {label}
      </Text>
    </div>
  );
}

function GuestView() {
  const [loading, setLoading] = useState(false);
  const [devPhone, setDevPhone] = useState("");
  const { openSnackbar } = useSnackbar();

  const handleLogin = async (task: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);
    try {
      // On success the auth atom flips to "member" and this view unmounts.
      await task();
      openSnackbar({
        text: "Đăng nhập thành công",
        type: "success",
        position: "top",
      });
    } catch (error) {
      openSnackbar({
        text: (error as Error)?.message || "Đăng nhập thất bại, thử lại sau",
        type: "error",
        position: "top",
      });
      setLoading(false);
    }
  };

  return (
    <Page className={PAGE_CLASS}>
      <div className="flex items-center gap-3 px-4 py-4 pt-12">
        <Avatar size={64}>
          <Icon icon="zi-user" />
        </Avatar>
        <div className="flex flex-col gap-1">
          <Text.Title size="small">Khách</Text.Title>
          <Text size="xSmall" className="text-[#767a7f] dark:text-[#8f9499]">
            Bạn chưa đăng nhập
          </Text>
        </div>
      </div>

      <div className="px-4">
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: "linear-gradient(135deg,#6e2901,#000000)" }}
        >
          <div className="absolute -right-6 -top-6 opacity-10">
            <GiEightBall size={140} className="text-orange-100" />
          </div>
          <div className="text-[18px] font-medium text-orange-300">
            HỘI VIÊN CLUB
          </div>
          <div className="relative mt-3 text-[22px] font-bold leading-tight">
            Trở thành hội viên
            <br />
            nhận ngay 30 phút chơi miễn phí
          </div>
          <Text size="xSmall" className="relative mt-3 text-gray-400">
            Đăng nhập một chạm bằng tài khoản Zalo
          </Text>
        </div>
      </div>

      <div className="mt-2 divide-y divide-black/5 px-4 dark:divide-white/10">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="flex items-center gap-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400">
              <Icon icon={benefit.icon} size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <Text size="small">{benefit.title}</Text>
              <Text
                size="xxSmall"
                className="mt-0.5 text-[#767a7f] dark:text-[#8f9499]"
              >
                {benefit.text}
              </Text>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-4">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleLogin(loginWithZalo)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0068ff] font-semibold text-white disabled:opacity-60"
        >
          {!loading && <SiZalo size={26} />}
          {loading ? "Đang đăng nhập..." : "Đăng nhập bằng Zalo"}
        </button>
        <Text
          size="xxSmall"
          className="mt-3 text-center text-[#767a7f] dark:text-[#8f9499]"
        >
          CULI BILLIARDS CLUB sẽ dùng tên và số điện thoại Zalo của bạn để tạo
          thẻ hội viên.
        </Text>
      </div>

      {import.meta.env.DEV && (
        <div className="mx-4 mt-6 flex gap-2 rounded-xl border border-dashed border-black/20 p-3 dark:border-white/20">
          <input
            value={devPhone}
            onChange={(e) => setDevPhone(e.target.value)}
            inputMode="tel"
            placeholder="[DEV] Số điện thoại"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            disabled={loading || !devPhone.trim()}
            onClick={() => handleLogin(() => loginWithPhone(devPhone.trim()))}
            className="text-sm font-semibold text-[#0068ff] disabled:opacity-40"
          >
            Đăng nhập
          </button>
        </div>
      )}
    </Page>
  );
}

function MemberView({ auth }: { auth: MemberState }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { openSnackbar } = useSnackbar();
  const { customer, card, points } = auth;

  useEffect(() => {
    getUserInfo({ avatarType: "large" })
      .then(({ userInfo }) => setProfile(userInfo))
      .catch(() => setProfile(null));
  }, []);

  return (
    <Page className={PAGE_CLASS}>
      <div className="flex items-start gap-3 px-4 py-4 dark:border-white/10 pt-12">
        <Avatar src={profile?.avatar} size={64}>
          {customer.name.charAt(0)}
        </Avatar>
        <div className="flex flex-col gap-1">
          <Text.Title size="small" className="truncate">
            {customer.name}
          </Text.Title>
          <Text
            size="xSmall"
            className="truncate text-[#767a7f] dark:text-[#8f9499]"
          >
            {customer.phone}
          </Text>
          <div className="flex">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8ba02]/15 px-2 py-1 text-[11px] font-semibold text-[#8a6d00] dark:bg-[#e8ba02]/20 dark:text-[#e8ba02]">
              <Icon icon="zi-star-solid" size={12} />
              Hạng {accountStats.tier}
            </span>
          </div>
        </div>
      </div>
      <div className="border-b border-black/5 px-2 dark:divide-white/10 pb-4 dark:border-white/10">
        <MemberCard
          name={customer.name}
          points={points}
          minutes={card.remaining_minutes}
        />
      </div>
      <div className="grid grid-cols-3 divide-x divide-black/5 border-b border-black/5 px-4 dark:divide-white/10 dark:border-white/10">
        <StatTile
          label="Điểm tích lũy"
          value={points.toLocaleString("vi-VN")}
          icon="zi-poll"
        />
        <StatTile
          label="Đơn hoàn thành"
          value={String(customer.order_count)}
          icon="zi-check-circle"
        />
        <StatTile
          label="Số may mắn"
          value={accountStats.luckyNumber}
          icon="zi-star"
        />
      </div>

      <button
        type="button"
        onClick={() =>
          openSnackbar({
            text: "Tính năng đang được phát triển",
            type: "info",
            position: "top",
          })
        }
        className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-4 dark:border-white/10"
      >
        <Icon icon="zi-notif" className="text-[#767a7f] dark:text-[#8f9499]" />
        <Text size="small" className="flex-1 text-left">
          Quản lý thông báo
        </Text>
        <Icon icon="zi-chevron-right" size={18} className="text-[#b9bdc1]" />
      </button>

      <div className="px-4 py-4">
        <Text.Title size="small">Thông báo của bạn</Text.Title>
        <div className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {notifications.map((notification) => (
            <div key={notification.id} className="flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#006af5]/10 text-[#006af5] dark:bg-[#52a0ff]/15 dark:text-[#52a0ff]">
                <Icon icon={notification.icon} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <Text size="small">{notification.title}</Text>
                <Text
                  size="xxSmall"
                  className="mt-0.5 text-[#767a7f] dark:text-[#8f9499]"
                >
                  {notification.subtitle}
                </Text>
                <Text
                  size="xxSmall"
                  className="mt-0.5 text-right text-[10px] text-[#767a7f] dark:text-[#8f9499]"
                >
                  {notification.time}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center gap-3 border-t border-black/5 px-4 py-4 text-red-500 dark:border-white/10"
      >
        <Icon icon="zi-leave" />
        <Text size="small" className="flex-1 text-left">
          Đăng xuất
        </Text>
      </button>
    </Page>
  );
}

function AccountPage() {
  const auth = useAuth();

  if (auth.status === "loading")
    return (
      <Page className={PAGE_CLASS + " items-center justify-center"}>
        <Spinner />
      </Page>
    );
  if (auth.status === "guest") return <GuestView />;
  return <MemberView auth={auth} />;
}

export default AccountPage;

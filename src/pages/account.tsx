import { useEffect, useState } from "react";
import { getUserInfo } from "zmp-sdk";
import { Avatar, Icon, Page, Text, useSnackbar } from "zmp-ui";
import type { IconString } from "zmp-ui/icon";

import { accountStats, notifications } from "@/mock/account";
import MemberCard from "@/components/memberCard";

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

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

function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { openSnackbar } = useSnackbar();

  useEffect(() => {
    getUserInfo({ avatarType: "large" })
      .then(({ userInfo }) => setProfile(userInfo))
      .catch(() => setProfile(null));
  }, []);

  return (
    <Page className="flex flex-col bg-white pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black">
      <div className="flex items-start gap-3 px-4 py-4 dark:border-white/10 pt-12">
        <Avatar src={profile?.avatar} size={64}>
          {profile?.name?.charAt(0)}
        </Avatar>
        <div className="flex flex-col gap-1">
          <Text.Title size="small" className="truncate">
            {profile?.name ?? "Khách"}
          </Text.Title>
          <Text
            size="xSmall"
            className="truncate text-[#767a7f] dark:text-[#8f9499]"
          >
            ID: {profile?.id ?? "--"}
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
        <MemberCard />
      </div>
      <div className="grid grid-cols-3 divide-x divide-black/5 border-b border-black/5 px-4 dark:divide-white/10 dark:border-white/10">
        <StatTile
          label="Điểm tích lũy"
          value={accountStats.points.toLocaleString("vi-VN")}
          icon="zi-poll"
        />
        <StatTile
          label="Đơn hoàn thành"
          value={String(accountStats.completedOrders)}
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
    </Page>
  );
}

export default AccountPage;

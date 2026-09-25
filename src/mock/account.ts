import type { IconString } from "zmp-ui/icon";

export interface AccountStats {
  tier: string;
  points: number;
  completedOrders: number;
  luckyNumber: string;
}

export interface AccountNotification {
  id: string;
  icon: keyof typeof IconString;
  title: string;
  time: string;
  subtitle?: string;
}

// Placeholder data — replace with real calls via `api.get(...)` from `@/api` once the backend is ready.
export const accountStats: AccountStats = {
  tier: "Vàng",
  points: 1280,
  completedOrders: 24,
  luckyNumber: "088888",
};

export const notifications: AccountNotification[] = [
  {
    id: "n1",
    icon: "zi-check-circle",
    title: "+22 điểm thưởng",
    subtitle: "Thanh toán hóa đơn",
    time: "2 giờ trước",
  },
  {
    id: "n2",
    icon: "zi-star",
    title: "+50 điểm thưởng",
    subtitle: "Mời bạn thành công",
    time: "Hôm qua",
  },
  {
    id: "n3",
    icon: "zi-star",
    title: "+30 điểm thưởng",
    subtitle: "Đăng ký hội viên",
    time: "3 ngày trước",
  },
];

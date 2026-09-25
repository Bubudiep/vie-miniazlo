export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  time: string;
  gradient: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  expiry: string;
  gradient: string;
}

export interface EventItem {
  id: string;
  title: string;
  location: string;
  date: string;
  gradient: string;
}

// Placeholder data — replace with real calls via `api.get(...)` from `@/api` once the backend is ready.
export const newsArticles: NewsArticle[] = [
  {
    id: "news-1",
    title: "GHV ra mắt bộ sưu tập thu đông 2026",
    summary: "Cập nhật xu hướng thời trang mới nhất với chất liệu cao cấp.",
    time: "2 giờ trước",
    gradient: "from-[#006af5] to-[#52a0ff]",
  },
  {
    id: "news-2",
    title: "5 mẹo phối đồ công sở thanh lịch",
    summary: "Gợi ý phối đồ giúp bạn tự tin hơn mỗi ngày đến văn phòng.",
    time: "Hôm qua",
    gradient: "from-[#6a40bf] to-[#8fc1ff]",
  },
  {
    id: "news-3",
    title: "GHV đạt mốc 1 triệu khách hàng",
    summary: "Cảm ơn sự tin tưởng của bạn trong suốt hành trình vừa qua.",
    time: "3 ngày trước",
    gradient: "from-[#12aee2] to-[#34b764]",
  },
];

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    title: "Giảm 50% cho đơn hàng đầu tiên",
    description: "Áp dụng cho khách hàng mới đăng ký tài khoản.",
    expiry: "30/09/2026",
    gradient: "from-[#dc1f18] to-[#e8ba02]",
  },
  {
    id: "promo-2",
    title: "Freeship toàn quốc",
    description: "Miễn phí vận chuyển cho mọi đơn hàng từ 200.000đ.",
    expiry: "15/10/2026",
    gradient: "from-[#12aee2] to-[#34b764]",
  },
  {
    id: "promo-3",
    title: "Tích điểm x2 cuối tuần",
    description: "Nhân đôi điểm thưởng cho mọi đơn hàng thứ 7, Chủ nhật.",
    expiry: "31/10/2026",
    gradient: "from-[#6a40bf] to-[#8fc1ff]",
  },
];

export const events: EventItem[] = [
  {
    id: "event-1",
    title: "Pop-up store GHV tại Vincom Đồng Khởi",
    location: "72 Lê Thánh Tôn, Quận 1, TP.HCM",
    date: "05/10/2026 - 12/10/2026",
    gradient: "from-[#006af5] to-[#52a0ff]",
  },
  {
    id: "event-2",
    title: "Livestream ra mắt bộ sưu tập mới",
    location: "Trên kênh TikTok & Zalo OA của GHV",
    date: "20/10/2026, 20:00",
    gradient: "from-[#6a40bf] to-[#8fc1ff]",
  },
  {
    id: "event-3",
    title: "Ngày hội khách hàng thân thiết",
    location: "Hệ thống cửa hàng GHV toàn quốc",
    date: "01/11/2026",
    gradient: "from-[#12aee2] to-[#34b764]",
  },
];

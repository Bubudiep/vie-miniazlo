import type { IconString } from "zmp-ui/icon";

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  sold?: number;
  badge?: string;
  category?: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  image?: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof IconString;
}

export const categories: Category[] = [
  { id: "all", label: "Tất cả" },
  { id: "food", label: "Đồ ăn" },
  { id: "drink", label: "Đồ uống" },
  { id: "other", label: "Khác" },
];

export const banners: Banner[] = [
  {
    id: "banner-1",
    title: "Giải đấu tháng thường niên",
    subtitle: "Bứt phá TOP 1 Trại Cúp",
    gradient: "from-[#006af5] to-[#52a0ff]",
    image:
      "https://img.magnific.com/free-photo/medium-shot-men-with-vests-near-pool-table_23-2148299218.jpg?w=1480",
  },
  {
    id: "banner-2",
    title: "Hội viên +",
    subtitle: "Ưu đã ngập tràn, muôn vàn trải nghiệm.",
    gradient: "from-[#6a40bf] to-[#8fc1ff]",
    image:
      "https://img.magnific.com/free-vector/webinar-template-billiards-club-pool-game_23-2150253847.jpg?w=1480",
  },
  {
    id: "banner-3",
    title: "1 Cơ dọn bàn",
    subtitle: "Thưởng bia, thưởng bia (Bia Hà Nội)",
    gradient: "from-[#12aee2] to-[#34b764]",
    image:
      "https://img.magnific.com/premium-photo/young-man-playing-billiard-posing-near-table-with-cue-his-hands_179755-318.jpg?w=1480",
  },
];

export const offers: Offer[] = [
  {
    id: "offer-1",
    title: "30 phút chơi",
    description: "Hội viên mới",
    icon: "zi-poll",
  },
  {
    id: "offer-2",
    title: "30 điểm thưởng",
    description: "Hội viên mới",
    icon: "zi-star",
  },
  {
    id: "offer-3",
    title: "Giảm 20%",
    description: "Đơn hàng đầu tiên",
    icon: "zi-favorite-list",
  },
];

export const newProducts: Product[] = [
  {
    id: "new-1",
    name: "Áo thun basic cotton",
    price: 129000,
    originalPrice: 179000,
    badge: "Mới",
  },
  { id: "new-2", name: "Quần jean slimfit", price: 349000, badge: "Mới" },
  {
    id: "new-3",
    name: "Giày sneaker trắng",
    price: 459000,
    originalPrice: 690000,
    badge: "Mới",
  },
  { id: "new-4", name: "Túi đeo chéo mini", price: 219000, badge: "Mới" },
];

export const bestSaleProducts: Product[] = [
  {
    id: "best-1",
    name: "Áo khoác gió 2 lớp",
    price: 289000,
    originalPrice: 450000,
    sold: 1230,
  },
  {
    id: "best-2",
    name: "Đầm suông thời trang",
    price: 259000,
    originalPrice: 399000,
    sold: 980,
  },
  { id: "best-3", name: "Balo laptop chống nước", price: 329000, sold: 754 },
  {
    id: "best-4",
    name: "Đồng hồ thể thao",
    price: 399000,
    originalPrice: 599000,
    sold: 612,
  },
];

export const catalogProducts: Product[] = [
  {
    id: "cat-1",
    name: "Áo thun basic cotton",
    price: 129000,
    originalPrice: 179000,
    badge: "Mới",
    category: "ao",
  },
  {
    id: "cat-2",
    name: "Áo khoác gió 2 lớp",
    price: 289000,
    originalPrice: 450000,
    sold: 1230,
    category: "ao",
  },
  { id: "cat-3", name: "Áo sơ mi linen", price: 219000, category: "ao" },
  {
    id: "cat-4",
    name: "Quần jean slimfit",
    price: 349000,
    badge: "Mới",
    category: "quan",
  },
  { id: "cat-5", name: "Quần short kaki", price: 189000, category: "quan" },
  {
    id: "cat-6",
    name: "Quần jogger thể thao",
    price: 229000,
    sold: 340,
    category: "quan",
  },
  {
    id: "cat-7",
    name: "Đầm suông thời trang",
    price: 259000,
    originalPrice: 399000,
    sold: 980,
    category: "dam",
  },
  { id: "cat-8", name: "Chân váy xếp ly", price: 199000, category: "dam" },
  {
    id: "cat-9",
    name: "Giày sneaker trắng",
    price: 459000,
    originalPrice: 690000,
    badge: "Mới",
    category: "giay",
  },
  { id: "cat-10", name: "Giày lười da nam", price: 399000, category: "giay" },
  {
    id: "cat-11",
    name: "Túi đeo chéo mini",
    price: 219000,
    badge: "Mới",
    category: "phukien",
  },
  {
    id: "cat-12",
    name: "Balo laptop chống nước",
    price: 329000,
    sold: 754,
    category: "phukien",
  },
  {
    id: "cat-13",
    name: "Đồng hồ thể thao",
    price: 399000,
    originalPrice: 599000,
    sold: 612,
    category: "phukien",
  },
];
export interface Product2 {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  sold?: number;
  badge?: string;
  category?: string;
  image: string;
}

export const products: Product2[] = [
  // --- ĐỒ UỐNG (DRINK) ---
  {
    id: "p1",
    name: "Bia Hơi Hà Nội (Ca 2L)",
    price: 65000,
    sold: 1250,
    badge: "Bán chạy",
    category: "drink",
    image:
      "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p2",
    name: "Bia Tiger Bạc (Thùng 24 lon)",
    price: 430000,
    originalPrice: 450000,
    sold: 420,
    badge: "Khuyến mãi",
    category: "drink",
    image:
      "https://images.unsplash.com/photo-1618886614638-80e3c15cd819?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p3",
    name: "Bia Sài Gòn Special (Chai)",
    price: 22000,
    sold: 890,
    category: "drink",
    image:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p4",
    name: "Nước Ngọt / Khoáng Cố định",
    price: 15000,
    sold: 310,
    category: "drink",
    image:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60",
  },

  // --- ĐỒ ĂN (FOOD) ---
  {
    id: "p5",
    name: "Lạc Rang / Lạc Luộc",
    price: 20000,
    sold: 2100,
    badge: "Mồi bén",
    category: "food",
    image:
      "https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p6",
    name: "Mực Khô Nướng Cồn (Con)",
    price: 180000,
    originalPrice: 200000,
    sold: 150,
    badge: "Cháy hàng",
    category: "food",
    image:
      "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p7",
    name: "Chân Gà Quái Thú Chiên Mắm",
    price: 95000,
    sold: 680,
    category: "food",
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p8",
    name: "Bò Tái Chanh",
    price: 135000,
    sold: 430,
    category: "food",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p9",
    name: "Nem Chua Rán / Nướng",
    price: 60000,
    sold: 520,
    category: "food",
    image:
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500&auto=format&fit=crop&q=60",
  },

  // --- KHÁC (OTHER) ---
  {
    id: "p10",
    name: "Khăn Lạnh Cao Cấp",
    price: 3000,
    sold: 5400,
    category: "other",
    image:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "p11",
    name: "Bật Lửa Cối",
    price: 5000,
    sold: 320,
    category: "other",
    image:
      "https://images.unsplash.com/photo-1585336261026-bc1510444503?w=500&auto=format&fit=crop&q=60",
  },
];

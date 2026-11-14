import { Box, Icon, Page, Sheet, Text } from "zmp-ui";
import logo from "@/images/logo.jpg";
import StoreHeader from "@/components/store-header";
import { formatDateTime } from "@/utils/format";
import { IoMdHeart, IoMdChatbubbles } from "react-icons/io";
import { FaFire } from "react-icons/fa";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NEWS_POSTS = [
  {
    id: 1,
    author: "H2 BILLIARDS",
    time: "2 giờ trước",
    content:
      "🎉 Chương trình ưu đãi tháng 9: Giảm 20% toàn bộ đồ uống từ 14h-17h hàng ngày! Nhanh tay đặt bàn ngay nhé các bạn ơi!",
    image: "https://via.placeholder.com/400x250",
    likes: 48,
    comments: 12,
  },
  {
    id: 2,
    author: "Admin",
    time: "5 giờ trước",
    content:
      "🎱 Thông báo: Sự kiện giải đấu bi-a hàng tháng sẽ diễn ra vào Chủ nhật tuần này. Phí tham gia 100k/người, giải nhất 2 triệu! Đăng ký tại quầy hoặc inbox cho club nhé!",
    image: null,
    likes: 65,
    comments: 24,
  },
  {
    id: 3,
    author: "H2 BILLIARDS",
    time: "1 ngày trước",
    content:
      "🔥 HOT: Nạp 5 giờ tặng ngay 1 giờ chơi + 1 nước ngọt miễn phí. Áp dụng cho thành viên mới và khách hàng thân thiết!",
    image: "https://via.placeholder.com/400x250",
    likes: 92,
    comments: 18,
  },
  {
    id: 4,
    author: "Admin",
    time: "2 ngày trước",
    content:
      "Cảm ơn các bạn đã ủng hộ H2 Billiards trong suốt thời gian qua! 💚 Chúng mình cam kết mang đến trải nghiệm chơi bi-a tốt nhất cho mọi người!",
    image: null,
    likes: 156,
    comments: 32,
  },
];

function HomePage() {
  const navigate = useNavigate();
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});
  const [commentPostId, setCommentPostId] = useState<number | null>(null);

  return (
    <Page className="flex flex-col gap-4 bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black">
      <StoreHeader />
      <div className="px-4 space-y-4">
        {NEWS_POSTS.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 pb-3">
              <img src={logo} className="w-10 h-10 rounded-full shadow-md" />
              <div className="flex-1">
                <Text.Title className="text-slate-900 font-semibold text-[15px]">
                  {post.author}
                </Text.Title>
                <Text size="xxSmall" className="text-slate-600">
                  {post.time}
                </Text>
              </div>
            </div>

            {/* Post Content */}
            <div className="px-4 pb-3">
              <Text size="small" className="text-slate-800 leading-relaxed">
                {post.content}
              </Text>
            </div>
            {/* Post Image */}
            {post.image && (
              <div className="w-full">
                <img
                  src={post.image}
                  className="w-full h-48 object-cover"
                  alt="Post"
                />
              </div>
            )}
            {/* Post Actions */}
            <div className="flex items-center justify-around border-t border-slate-100 p-3">
              <button
                type="button"
                aria-pressed={Boolean(likedPosts[post.id])}
                onClick={() => setLikedPosts((current) => ({ ...current, [post.id]: !current[post.id] }))}
                className={`flex items-center gap-2 transition-colors ${likedPosts[post.id] ? "text-rose-600" : "text-slate-600 hover:text-rose-500"}`}
              >
                <IoMdHeart size={20} />
                <Text size="small" className="font-medium">
                  {post.likes + (likedPosts[post.id] ? 1 : 0)}
                </Text>
              </button>
              <button
                type="button"
                aria-label={`Mở bình luận cho bài viết của ${post.author}`}
                onClick={() => setCommentPostId(post.id)}
                className="flex items-center gap-2 text-slate-600 transition-colors hover:text-green-500"
              >
                <IoMdChatbubbles size={20} />
                <Text size="small" className="font-medium">
                  {post.comments}
                </Text>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="bg-gradient-to-br from-coral-50 to-yellow-50 rounded-2xl p-4 border-2 border-coral-200 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <FaFire className="text-coral-500 text-xl" />
            <Text.Title className="text-slate-900 font-bold">
              Ưu đãi HOT trong tuần
            </Text.Title>
          </div>
          <Text size="small" className="text-slate-700 mb-3">
            Tham gia ngay để không bỏ lỡ các chương trình khuyến mãi hấp dẫn!
          </Text>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="w-full rounded-xl bg-coral-500 py-3 font-semibold text-white transition-colors hover:bg-coral-600"
          >
            Xem chi tiết
          </button>
        </div>
      </div>
      <Sheet visible={commentPostId !== null} onClose={() => setCommentPostId(null)} autoHeight swipeToClose unmountOnClose>
        <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          <div className="flex items-center justify-between">
            <Text.Title size="small">Bình luận bài viết</Text.Title>
            <button type="button" aria-label="Đóng bình luận" onClick={() => setCommentPostId(null)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <Icon icon="zi-close" />
            </button>
          </div>
          <Text size="small" className="text-slate-600">Bài viết hiện chưa có bình luận mới.</Text>
          <button type="button" onClick={() => setCommentPostId(null)} className="min-h-11 w-full rounded-lg bg-emerald-700 text-sm font-semibold text-white">Đóng</button>
        </Box>
      </Sheet>
    </Page>
  );
}

export default HomePage;

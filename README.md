# H2 Billiards Web App

Ứng dụng React chạy trên trình duyệt thông thường, dùng PocketBase để đăng nhập và lưu dữ liệu. Không cần mở trong Zalo Mini App.

## Chạy local

```powershell
cd "D:\My App\billiard"
.\scripts\start-dev-backend.ps1
npm install
npm run dev
```

PocketBase chạy tại `http://127.0.0.1:8390` (Admin UI: `http://127.0.0.1:8390/_/`). Nếu PocketBase **đã chạy** trước khi cập nhật, dừng tiến trình hiện có rồi khởi động lại để áp dụng migration trong `pocketbase/pb_migrations/` và nạp hooks; script `start-dev-backend.ps1` sẽ không tự khởi động lại một server đang chạy. Mở URL Vite in ra, thường là `http://localhost:5173`. Frontend mặc định kết nối PocketBase local qua `src/api/pocketbase.ts`, không cần ngrok hay Zalo App ID.

Nếu cần thay đổi địa chỉ backend, đặt `VITE_API_BASE_URL` trong `.env` trước khi chạy/build. `127.0.0.1` chỉ dùng được khi trình duyệt và PocketBase chạy trên cùng máy; thiết bị khác cần một địa chỉ mạng truy cập được và cấu hình PocketBase lắng nghe trên mạng đó.

## Build và triển khai

```powershell
npm run build
npm run start
```

Build tạo thư mục `dist/`. Server production trong `server.mjs` phục vụ thư mục này, bật SPA fallback và proxy `/api/public/pb/*` tới PocketBase nội bộ. Trình duyệt luôn dùng URL cùng nguồn `/api/public/pb`, không gọi trực tiếp `127.0.0.1` hoặc PocketBase public.

Biến môi trường production:

```env
PB_URL=http://127.0.0.1:8390
```

Reverse proxy hoặc Cloudflare Tunnel chỉ cần trỏ `h2.chamcongchua.com` tới server web port `3300`.

## Đăng ký và phê duyệt

Người dùng chọn cửa hàng, nhập họ tên (`fullname`), số điện thoại và mật khẩu để tự đăng ký. Mặc định tài khoản được duyệt ngay nên có thể đăng nhập sau khi đăng ký. Admin cửa hàng có thể mở **Tài khoản → Duyệt tài khoản** để bật yêu cầu phê duyệt cho người đăng ký *mới* vào cửa hàng mình, xem danh sách chờ và duyệt từng người. Bật chế độ này không thu hồi quyền đăng nhập của tài khoản đã được duyệt trước đó. Tài khoản cũ có thể chưa có họ tên hoặc số điện thoại; superuser có thể bổ sung trong PocketBase Admin UI.

Admin cần có `role=admin` và được gắn đúng `store` trong collection `users` (superuser thiết lập ban đầu qua Admin UI). Không đặt quyền admin hoặc trạng thái duyệt từ frontend.

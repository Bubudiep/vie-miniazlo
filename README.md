# H2 Billiards Web App

Ứng dụng React chạy trên trình duyệt thông thường, dùng PocketBase để đăng nhập và lưu dữ liệu. Không cần mở trong Zalo Mini App.

## Chạy local

```powershell
cd "D:\My App\billiard"
.\scripts\start-dev-backend.ps1
cd vie-minizalo
npm install
npm run dev
```

PocketBase chạy tại `http://127.0.0.1:8390` (Admin UI: `http://127.0.0.1:8390/_/`). Nếu PocketBase **đã chạy** trước khi cập nhật, dừng tiến trình hiện có rồi khởi động lại để áp dụng migration trong `pocketbase/pb_migrations/` và nạp hooks; script `start-dev-backend.ps1` sẽ không tự khởi động lại một server đang chạy. Mở URL Vite in ra, thường là `http://localhost:5173`. Frontend mặc định kết nối PocketBase local qua `src/api/pocketbase.ts`, không cần ngrok hay Zalo App ID.

Nếu cần thay đổi địa chỉ backend, đặt `VITE_API_BASE_URL` trong `.env` trước khi chạy/build. `127.0.0.1` chỉ dùng được khi trình duyệt và PocketBase chạy trên cùng máy; thiết bị khác cần một địa chỉ mạng truy cập được và cấu hình PocketBase lắng nghe trên mạng đó.

## Build và triển khai

```powershell
npm run build
npm run preview
```

Build tạo thư mục `dist/`. Triển khai nội dung thư mục này lên dịch vụ web tĩnh và bật SPA fallback về `index.html` để các đường dẫn như `/account` hoạt động khi tải lại trang. Cấu hình `VITE_API_BASE_URL` trước khi build.

## Đăng ký và phê duyệt

Người dùng chọn cửa hàng, nhập họ tên (`fullname`), số điện thoại và mật khẩu để tự đăng ký. Mặc định tài khoản được duyệt ngay nên có thể đăng nhập sau khi đăng ký. Admin cửa hàng có thể mở **Tài khoản → Duyệt tài khoản** để bật yêu cầu phê duyệt cho người đăng ký *mới* vào cửa hàng mình, xem danh sách chờ và duyệt từng người. Bật chế độ này không thu hồi quyền đăng nhập của tài khoản đã được duyệt trước đó. Tài khoản cũ có thể chưa có họ tên hoặc số điện thoại; superuser có thể bổ sung trong PocketBase Admin UI.

Admin cần có `role=admin` và được gắn đúng `store` trong collection `users` (superuser thiết lập ban đầu qua Admin UI). Không đặt quyền admin hoặc trạng thái duyệt từ frontend.

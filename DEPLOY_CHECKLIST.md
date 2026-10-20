# Kiểm tra chạy local

Ứng dụng chạy trên trình duyệt và kết nối PocketBase trên cùng máy; không dùng Zalo Mini App hoặc tunnel.

1. Từ thư mục `billiard`, chạy `./scripts/start-dev-backend.ps1` trong PowerShell (hoặc `./start_backend.sh` trong môi trường có PocketBase executable tương ứng).
2. Kiểm tra `http://127.0.0.1:8390/api/health` và Admin UI tại `http://127.0.0.1:8390/_/`.
3. Trong `vie-minizalo`, chạy `npm install` và `npm run dev`.
4. Mở URL Vite in ra trên cùng máy, đăng nhập bằng tài khoản `users` đã được phê duyệt, kiểm tra trang bàn, menu và ví.
5. Chạy `npm run build` để xác nhận frontend build được.

`VITE_API_BASE_URL` mặc định là `http://127.0.0.1:8390`. Khi truy cập từ máy khác, cần URL backend mà máy đó truy cập được và PocketBase phải lắng nghe trên địa chỉ mạng phù hợp; không đưa `127.0.0.1` của máy chủ vào frontend trên thiết bị khác. Nếu triển khai frontend qua HTTPS, backend cũng phải được phục vụ qua HTTPS.

# Ghi chú hồi quy sơ đồ bàn

Sơ đồ bàn dùng canvas có kích thước nội dung cố định để giữ vị trí ổn định trên mobile. Vùng nhìn phải cuộn được theo cả hai chiều; chỉ dùng `overflow-x-auto` có thể làm các bàn ở hàng phía dưới bị cắt và khiến map trông như không hiển thị.

Khi sửa `src/pages/tables.tsx`, kiểm tra canvas vẫn giữ kích thước theo `canvasWidth`/`canvasHeight`, vùng nhìn dùng `overflow-auto`, refresh từ hàng chờ/realtime đi qua một cơ chế chống response cũ ghi đè, và chạy `npm run build`.

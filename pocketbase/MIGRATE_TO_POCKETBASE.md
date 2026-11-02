# Hướng dẫn chuyển sang PocketBase

## Các bước đã thực hiện

### 1. Thêm field `is_approved` vào User collection
- Tạo migration: `pocketbase/pb_migrations/1791600000_add_is_approved_to_users.js`
- Field này mặc định là `false` khi user đăng ký

### 2. Cập nhật User interface
- Thêm `is_approved?: boolean` vào interface User trong `vie-minizalo/src/api/pocketbase.ts`

### 3. Tạo authentication hook
- File: `pocketbase/pb_hooks/user_approval.pb.js`
- Hook `onRecordAuthRequest` kiểm tra `is_approved` trước khi cho phép đăng nhập
- Nếu `is_approved = false`, trả về lỗi: "Tài khoản chưa được phê duyệt"
- Log các event: user_registered, user_approved

### 4. Cập nhật frontend
- Thêm `is_approved: false` khi tạo user mới trong `AuthContext.tsx`
- Form đăng ký không yêu cầu email (có thể để trống)

## Cách chạy

### Bước 1: Chạy PocketBase migration
```bash
cd pocketbase
./pocketbase.exe migrate
```

### Bước 2: Khởi động PocketBase
```bash
./pocketbase.exe serve --http="127.0.0.1:8390"
```

### Bước 3: Phê duyệt user trong PocketBase Admin
1. Truy cập: http://127.0.0.1:8390/_/
2. Đăng nhập admin
3. Vào collection `users`
4. Tìm user cần phê duyệt
5. Tick vào checkbox `is_approved`
6. Lưu lại

## Logic hoạt động

1. **User đăng ký**: 
   - Điền form (họ, tên, username, password)
   - `is_approved` tự động set = `false`
   - Hiển thị thông báo: "Đăng ký thành công! Vui lòng chờ admin phê duyệt"

2. **User cố gắng đăng nhập**:
   - Nếu `is_approved = false`: Lỗi "Tài khoản chưa được phê duyệt"
   - Nếu `is_approved = true`: Đăng nhập thành công

3. **Admin phê duyệt**:
   - Vào PocketBase Admin UI
   - Set `is_approved = true`
   - User có thể đăng nhập ngay

## Lưu ý

- Django backend KHÔNG CẦN nữa, logic đã chuyển hoàn toàn sang PocketBase
- Tất cả authentication, authorization đều qua PocketBase hooks
- PocketBase Admin UI thay thế Django Admin để quản lý users

# PocketBase Schema Update - Remove Email Requirement

Bạn cần cập nhật schema của collection `users` trong PocketBase Admin UI để loại bỏ yêu cầu email.

## Bước 1: Truy cập Admin UI
Mở: http://127.0.0.1:8390/_/
Đăng nhập với: admin@ccc.com / Hoanghai12!

## Bước 2: Cập nhật Users Collection

1. Vào **Collections** → Click vào collection **users**
2. Tìm field **email** trong danh sách fields
3. Click **Edit** field email
4. **Bỏ check** các options sau:
   - ❌ **Required** (cho phép email để trống)
   - ❌ **Unique** (nếu đang bật - không bắt buộc unique vì có thể null)
5. Click **Save**

## Bước 3: Verify Schema

Sau khi update, schema của users collection sẽ cho phép:
- ✅ Tạo user chỉ với `username` + `password` (không cần email)
- ✅ Tạo user với Zalo authentication (auto-generate username từ `zalo_id`)
- ✅ Email field là optional

## Kết quả

Hệ thống giờ sẽ hỗ trợ 2 loại user:
1. **Zalo users**: `username = "zalo_{zalo_id}"`, không có email
2. **Normal users**: `username` tự chọn, email optional

## Authentication Flow

### Zalo Login Flow:
```
Frontend → getAccessToken() from Zalo SDK
       → POST /api/zalo/auth { access_token }
       → PocketBase verifies with Zalo API
       → Find/Create user with zalo_id
       → Return PB auth token
```

### Password Login Flow:
```
Frontend → POST to PocketBase
       → pb.collection('users').authWithPassword(username, password)
       → Return PB auth token
```

Sau khi hoàn tất bước này, restart PocketBase để đảm bảo schema được load đúng.

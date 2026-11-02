# Hướng dẫn cấu hình Zalo Login cho PocketBase

## Tổng quan

Hệ thống Zalo login cho phép người dùng đăng nhập vào ứng dụng Zalo Mini App bằng tài khoản Zalo của họ. Backend PocketBase sẽ tự động tạo tài khoản user mới nếu chưa tồn tại.

## Cấu trúc Database đã chuẩn bị sẵn

### Collection: `users` (auth collection)

Các trường quan trọng cho Zalo login:

| Trường | Kiểu | Bắt buộc | Unique | Mô tả |
|--------|------|----------|--------|-------|
| `id` | text | ✓ | ✓ | ID tự động (15 ký tự) |
| `username` | text | ✓ | ✓ | Username (auto-gen: `zalo_{zalo_id}`) |
| `password` | password | ✓ | - | Mật khẩu (auto-gen random 32 chars) |
| `email` | email | ✗ | ✓ | Email (optional) |
| `zalo_id` | text | ✗ | ✓ | Zalo User ID từ Zalo Graph API |
| `company` | relation | ✗ | - | Link tới công ty (optional) |
| `role` | select | ✗ | - | Role: `admin` hoặc `user` |
| `verified` | bool | ✗ | - | Trạng thái xác thực |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_zalo_id ON users (zalo_id) WHERE zalo_id != ''
CREATE UNIQUE INDEX idx_username ON users (username)
CREATE UNIQUE INDEX idx_email__pb_users_auth_ ON users (email) WHERE email != ''
```

### Collection: `companies`

Nếu bạn muốn gán user vào công ty cụ thể:

| Trường | Kiểu | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `id` | text | ✓ | Company ID (15 chars) |
| `name` | text | ✓ | Tên công ty |
| `service_type` | select | ✗ | Loại dịch vụ: retail, restaurant, wholesale, service, other |
| `address` | text | ✗ | Địa chỉ |

## API Endpoint đã cài đặt

### POST `/api/zalo/auth`

File: `pb_hooks/zalo_auth.pb.js`

**Request:**
```json
{
  "access_token": "ZALO_ACCESS_TOKEN_FROM_SDK"
}
```

**Response (Success - 200):**
```json
{
  "token": "POCKETBASE_AUTH_TOKEN",
  "record": {
    "id": "abc123...",
    "username": "zalo_1234567890",
    "zalo_id": "1234567890",
    "company": "",
    "role": "",
    "email": "",
    "verified": true,
    "created": "2026-10-13 00:00:00",
    "updated": "2026-10-13 00:00:00"
  }
}
```

**Response (Error - 400):**
```json
{
  "message": "Invalid Zalo access token",
  "data": {},
  "status": 400
}
```

**Logic:**
1. Nhận `access_token` từ Zalo Mini App SDK
2. Gọi Zalo Graph API: `GET https://graph.zalo.me/v2.0/me?fields=id,name,picture&access_token={token}`
3. Lấy `zalo_id` từ response
4. Tìm user có `zalo_id` này trong DB
5. Nếu không tồn tại → Tạo user mới với:
   - `username`: `zalo_{zalo_id}`
   - `password`: random 32 ký tự
   - `zalo_id`: ID từ Zalo
   - `verified`: true
6. Tạo PocketBase auth token
7. Trả về token + user record

## Cách sử dụng

### 1. Khởi động PocketBase

```bash
cd pocketbase
./pocketbase.exe serve --http=127.0.0.1:8390
```

### 2. Kiểm tra API health

```bash
curl http://127.0.0.1:8390/api/health
```

### 3. Từ Zalo Mini App frontend

Code đã có sẵn trong:
- `vie-minizalo/src/api/zaloAuth.ts` - API functions
- `vie-minizalo/src/contexts/AuthContext.tsx` - Auth context
- `vie-minizalo/src/pages/login.tsx` - Login page

**Flow:**
```typescript
// 1. User click "Đăng nhập với Zalo"
const handleZaloLogin = async () => {
  await loginWithZalo();
}

// 2. loginWithZalo sẽ:
//    - Lấy access_token từ Zalo SDK
//    - Gọi POST /api/zalo/auth
//    - Lưu token vào PocketBase authStore
//    - Redirect về trang chủ
```

## Tạo dữ liệu test

### Tạo Company (optional)

Vào PocketBase Admin UI: http://127.0.0.1:8390/_/

1. Mở collection `companies`
2. Click "New record"
3. Nhập:
   - **name**: Tên công ty (VD: "Bida ABC")
   - **service_type**: chọn một trong: retail/restaurant/wholesale/service/other
   - **address**: Địa chỉ (optional)
4. Save → Lấy `id` của company vừa tạo

### Gán Company cho User sau khi đăng nhập

**Cách 1: Qua Admin UI**
1. Sau khi user đăng nhập lần đầu qua Zalo
2. Vào collection `users` → Tìm user có `zalo_id`
3. Edit → Chọn `company` từ dropdown
4. Chọn `role`: admin hoặc user
5. Save

**Cách 2: Tự động trong code** (nếu cần)

Sửa file `pb_hooks/zalo_auth.pb.js`:
```javascript
// Step 3: Create user if doesn't exist
if (!user) {
  // ... existing code ...
  
  user.set("zalo_id", zaloId);
  user.set("verified", true);
  
  // AUTO-ASSIGN COMPANY (nếu cần)
  const defaultCompanyId = "company_id_here"; // Thay bằng company ID thực
  user.set("company", defaultCompanyId);
  user.set("role", "user"); // Hoặc "admin"
  
  $app.dao().saveRecord(user);
}
```

## Testing

### Test 1: API endpoint trực tiếp

```bash
# Test với fake token (sẽ fail nhưng endpoint hoạt động)
curl -X POST http://127.0.0.1:8390/api/zalo/auth \
  -H "Content-Type: application/json" \
  -d '{"access_token":"fake_token"}'
```

Expected: Lỗi "Invalid Zalo access token"

### Test 2: Trong Zalo Mini App

1. Deploy app lên Zalo Mini App (hoặc test trên Zalo Developer Tools)
2. Click nút "Đăng nhập với Zalo"
3. Cho phép quyền truy cập
4. Kiểm tra console logs (trong `zaloAuth.ts` có log `[Zalo Auth]`)
5. Kiểm tra trong PocketBase Admin → Collection `users` → Có user mới

### Test 3: Kiểm tra database

```bash
# Vào PocketBase Admin
# http://127.0.0.1:8390/_/
# Login với admin account
# Xem collection "users" → Tìm user có zalo_id
```

## Troubleshooting

### Lỗi: "access_token is required"
→ Frontend không gửi access_token trong request body

### Lỗi: "Invalid Zalo access token"
→ Access token không hợp lệ hoặc đã hết hạn. Kiểm tra:
- Zalo Mini App config đúng chưa
- Access token có được lấy từ SDK không

### Lỗi: "Authentication failed"
→ Lỗi từ backend. Kiểm tra:
- `pb.log` để xem chi tiết
- Schema `users` có trường `zalo_id` chưa

### User đăng nhập được nhưng không thấy dữ liệu
→ Kiểm tra Collection Rules:
- Các collection như `products`, `tables` có rule: `@request.auth.company = company`
- User phải có `company` được gán

## Security Notes

1. **Access Token**: Không lưu access_token từ Zalo vào database
2. **Password**: Password auto-gen là random, user không cần biết
3. **Token Duration**: PocketBase auth token mặc định expire sau 5 ngày (432000s)
4. **Rate Limiting**: Nên thêm rate limiting cho endpoint `/api/zalo/auth`

## Next Steps

Sau khi user đăng nhập thành công:

1. **Onboarding flow**: Nếu user chưa có company → Hướng dẫn tạo/join company
2. **Profile setup**: Cho phép user cập nhật thông tin cá nhân
3. **Permission management**: Phân quyền dựa trên `role` field
4. **Multi-company support**: Sử dụng collection `memberships` để 1 user thuộc nhiều company

## Files liên quan

**Backend:**
- `pocketbase/pb_hooks/zalo_auth.pb.js` - Zalo auth endpoint
- `pocketbase/pb_schema.json` - Database schema
- `pocketbase/pb_migrations/1791537002_fix_zalo_id_optional.js` - Migration thêm zalo_id

**Frontend:**
- `vie-minizalo/src/api/zaloAuth.ts` - Zalo auth API
- `vie-minizalo/src/api/pocketbase.ts` - PocketBase client config
- `vie-minizalo/src/contexts/AuthContext.tsx` - Auth state management
- `vie-minizalo/src/pages/login.tsx` - Login UI

## Support

Nếu gặp vấn đề, kiểm tra:
1. Console logs trong browser (có prefix `[Zalo Auth]`)
2. File `pocketbase/pb.log` - Server logs
3. PocketBase Admin UI - Xem records và collection rules

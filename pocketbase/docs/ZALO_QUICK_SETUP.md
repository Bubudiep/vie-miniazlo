# Zalo Login - Quick Setup

## ✅ Đã cài đặt sẵn

### Database Schema
- ✅ Collection `users` với trường `zalo_id` (unique)
- ✅ Collection `companies` để quản lý công ty
- ✅ Collection `memberships` để user thuộc nhiều company
- ✅ Indexes và constraints

### Backend API
- ✅ Endpoint: `POST /api/zalo/auth`
- ✅ File: `pb_hooks/zalo_auth.pb.js`
- ✅ Logic: Auto-create user nếu chưa tồn tại

### Frontend Code
- ✅ `src/api/zaloAuth.ts` - Zalo auth functions
- ✅ `src/contexts/AuthContext.tsx` - Auth state
- ✅ `src/pages/login.tsx` - Login UI

## 🚀 Để sử dụng

### 1. Start PocketBase
```bash
cd pocketbase
./pocketbase.exe serve --http=127.0.0.1:8390
```

### 2. Tạo Company đầu tiên (Optional)

**Via Admin UI:** http://127.0.0.1:8390/_/

1. Login với admin account
2. Collection `companies` → New record
3. Nhập:
   - `name`: "Công ty ABC"
   - `service_type`: chọn 1 trong [retail, restaurant, wholesale, service, other]
4. Save → Copy `id` của company

### 3. User đăng nhập qua Zalo

Từ Zalo Mini App:
1. Click "Đăng nhập với Zalo"
2. Cho phép quyền
3. ✅ Tự động tạo user mới trong `users` collection

### 4. Gán Company cho User (sau lần đăng nhập đầu)

**Via Admin UI:**
1. Collection `users` → Tìm user vừa tạo (có `zalo_id`)
2. Edit:
   - `company`: chọn company từ step 2
   - `role`: chọn `admin` hoặc `user`
3. Save

**Hoặc Auto-assign trong code** (sửa `pb_hooks/zalo_auth.pb.js`):
```javascript
user.set("company", "COMPANY_ID_HERE");
user.set("role", "user");
```

## 📋 Collection Rules mặc định

Các collection có company scope:
```javascript
// products, tables, customers, etc.
listRule: "@request.auth.company = company"
```

→ User phải có `company` thì mới thấy data!

## 🔍 Debug

### Frontend logs
Mở Console → Tìm logs với prefix `[Zalo Auth]`

### Backend logs
```bash
tail -f pocketbase/pb.log
```

### Admin UI
http://127.0.0.1:8390/_/
- Xem users collection
- Check company assignments
- Review logs

## ⚠️ Common Issues

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Màn hình chớp nháy | Lỗi API hoặc token không hợp lệ | Check console logs |
| User login OK nhưng không thấy data | Chưa gán `company` | Gán company qua Admin UI |
| "Invalid access token" | Zalo SDK config sai | Check Zalo Mini App settings |

## 📚 Docs đầy đủ

Xem [ZALO_LOGIN_SETUP.md](./ZALO_LOGIN_SETUP.md) để biết chi tiết về:
- API endpoint specification
- Testing strategies
- Security considerations
- Multi-company setup
- Troubleshooting guide

# Zalo Login Troubleshooting Guide

## Lỗi: "fail to get Zalo token"

### Nguyên nhân
Zalo SDK không thể lấy access token do một trong các lý do:
1. App chưa khai báo `permission` trong `app-config.json`
2. User chưa cho phép quyền truy cập
3. App chưa được Zalo phê duyệt scopes
4. SDK chưa được khởi tạo đúng cách

### ✅ Giải pháp đã áp dụng

#### 1. Thêm permission vào `app-config.json`

**File: `vie-minizalo/app-config.json`**

```json
{
  "app": {
    "title": "bida-app",
    ...
  },
  "permission": {
    "scope.userInfo": {
      "reason": "Ứng dụng cần truy cập thông tin của bạn để đăng nhập"
    },
    "scope.userPhonenumber": {
      "reason": "Ứng dụng cần số điện thoại để liên hệ khi cần thiết"
    }
  },
  ...
}
```

#### 2. Request authorization trước khi lấy token

**File: `src/api/zaloAuth.ts`**

```typescript
// Step 0: Request authorization first
const authResult = await authorize({
  scopes: ['scope.userInfo', 'scope.userPhonenumber']
});

// Step 1: Get access token
const { accessToken } = await getAccessToken({});
```

### 🔍 Kiểm tra

Sau khi deploy lại, kiểm tra console logs:

```
[Zalo Auth] Starting authentication...
[Zalo Auth] Requesting user authorization...
[Zalo Auth] Authorization result: { ... }
[Zalo Auth] Getting access token...
[Zalo Auth] Token result: {"accessToken":"..."}
[Zalo Auth] Got access token: YES
```

Nếu vẫn thấy `Got access token: NO`, check:

1. **Zalo Developer Console**
   - Vào https://developers.zalo.me/
   - Login và chọn app của bạn
   - Tab "Permissions" → Kiểm tra các scopes đã được enable chưa
   - Required scopes:
     - `scope.userInfo` (User Profile)
     - `scope.userPhonenumber` (Phone Number) - optional

2. **App Review Status**
   - Một số scopes cần Zalo review và approve
   - Trong môi trường Development, thường auto-approve
   - Trong Production, phải submit for review

3. **Test Account**
   - Thêm Zalo test users trong Developer Console
   - Test users có thể bypass một số restrictions

## Các lỗi khác

### "Authentication failed" sau khi có token

**Console logs:**
```
[Zalo Auth] Got access token: YES
[Zalo Auth] Response status: 400
[Zalo Auth] Backend error: {message: "Invalid Zalo access token"}
```

**Nguyên nhân:**
- Backend không thể verify token với Zalo API
- Token hết hạn
- Network issue giữa PocketBase và Zalo

PocketBase phải gọi Graph API bằng `access_token` ở header và `miniapp_id` đúng với `APP_ID` của Mini App. Khi chạy local, đặt biến môi trường trước khi khởi động:

```powershell
$env:ZALO_MINIAPP_ID="3664088958058691958"
.\pocketbase.exe serve --http=127.0.0.1:8390
```

Nếu cấu hình đúng, token giả sẽ trả `401` với mã `zalo_token_rejected`; đây là phản hồi xác minh bình thường, không phải lỗi kết nối.

**Debug:**
```bash
# Kiểm tra PocketBase logs
cd pocketbase
tail -f pb.log
```

Tìm dòng:
```
Zalo API error: 400 {...}
```

### "Tài khoản chưa được phê duyệt"

**Nguyên nhân:**
- Hook `user_approval.pb.js` đang enabled (đã disable)
- User có `is_approved: false`

**Fix:**
1. Vào PocketBase Admin → Users
2. Tìm user → Edit
3. Set `is_approved: true` (nếu có field này)

### User login OK nhưng không thấy data

**Nguyên nhân:**
- User chưa được gán `company`
- Collection rules block access

**Fix:**
```sql
-- Check user company
SELECT id, username, company, role FROM users WHERE zalo_id = 'USER_ZALO_ID';

-- Gán company
UPDATE users SET company = 'COMPANY_ID', role = 'user' WHERE id = 'USER_ID';
```

Hoặc qua Admin UI:
1. Users collection → Find user
2. Edit: Select company + role
3. Save

## Deploy Checklist

Trước khi deploy:

- [ ] `app-config.json` có `permission` block
- [ ] PocketBase đang chạy và accessible từ internet (hoặc ngrok)
- [ ] Đặt `VITE_API_BASE_URL` trong `.env` thành URL HTTPS public của PocketBase rồi deploy lại
- [ ] Collection `users` có field `zalo_id`
- [ ] Backend hook `pb_hooks/zalo_auth.pb.js` exists và valid

Sau deploy:

- [ ] Test login flow
- [ ] Check console logs
- [ ] Verify user created trong PocketBase Admin
- [ ] Gán company cho user
- [ ] Test lại để xem data

## Debug Commands

### Check PocketBase health
```bash
curl http://YOUR_POCKETBASE_URL/api/health
```

### Test Zalo auth endpoint
```bash
curl -X POST http://YOUR_POCKETBASE_URL/api/zalo/auth \
  -H "Content-Type: application/json" \
  -d '{"access_token":"test"}'
```

Expected: `{"message":"Invalid Zalo access token",...}` (400)

### Check users collection schema
```bash
# Login to PocketBase Admin
# Navigate to Collections → users
# Verify fields: username, zalo_id, company, role
```

## Environment-Specific Issues

### Development Environment
- Test với Zalo Developer Tools
- Logs rõ ràng trong console
- Có thể test với test accounts

### Production Environment
- Cần Zalo approve app trước
- Permissions phải được review
- SSL certificate required cho backend
- Rate limiting considerations

## Getting Help

Nếu vẫn gặp lỗi:

1. **Collect logs:**
   ```
   - Browser console (full logs với [Zalo Auth] prefix)
   - PocketBase logs (pb.log)
   - Screenshot màn hình lỗi
   ```

2. **Check Zalo docs:**
   - https://mini.zalo.me/docs/api/
   - https://developers.zalo.me/docs/

3. **Common issues on Zalo forums:**
   - Token expires too fast
   - CORS issues
   - Permissions not granted

## FAQ

**Q: Token có expire không?**
A: Có, Zalo access token thường expire sau vài giờ. App cần handle refresh token hoặc re-login.

**Q: Có cần HTTPS cho backend không?**
A: Development có thể dùng HTTP. Production bắt buộc HTTPS để Zalo accept requests.

**Q: Làm sao test local?**
A: Không thể test hoàn toàn local. Cần deploy hoặc dùng ngrok để expose PocketBase.

**Q: User có thể login nhiều lần không?**
A: Có, mỗi lần login tạo token mới. Old tokens vẫn valid cho đến khi expire.

**Q: Xóa user test như thế nào?**
A: Vào PocketBase Admin → Users → Delete record. Zalo_id sẽ được freed để test lại.

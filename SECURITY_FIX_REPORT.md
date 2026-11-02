# BÁO CÁO SỬA LỖI BẢO MẬT: USER FIELD PROTECTION

## 1. LỖ HỔNG ĐÃ XÁC ĐỊNH

### Lỗ hổng 1: Admin Privilege Escalation
**File:** `pocketbase/pb_hooks/users_field_protection.pb.js` (line 29-31)
```javascript
if (isAdmin) {
  return  // Admin bypass toàn bộ kiểm tra
}
```

**Hậu quả:**
- Admin tự sửa `company` → chuyển sang công ty khác
- Admin tự sửa `role` → không bị giới hạn
- Admin tự sửa `is_system_admin = true` → leo thang đặc quyền

### Lỗ hổng 2: Cross-User Modification Bypass
**File:** `pocketbase/pb_hooks/users_field_protection.pb.js` (line 33-35)
```javascript
if (!isSelfUpdate) {
  return  // Không phải tự update → bỏ qua kiểm tra
}
```

**Kết hợp với API Rule (line 119 của `pb_schema.json`):**
```json
"updateRule": "id = @request.auth.id || @request.auth.role = \"admin\""
```

**Hậu quả:**
- Admin update User B → hook return ngay line 33
- Không kiểm tra protected fields
- Admin có thể sửa `company`, `role`, `is_system_admin` của bất kỳ user nào

## 2. NGUYÊN TẮC SỬA

**Chính sách bảo mật đúng:**
- CHỈ `_superusers` (admin panel) được sửa protected fields
- `users.role = "admin"` KHÔNG có đặc quyền sửa protected fields
- Áp dụng cho cả self-update và cross-user update

**Logic mới:**
1. Kiểm tra có protected field nào trong request không
2. Nếu không có → cho phép (update bình thường)
3. Nếu có → từ chối TOÀN BỘ, trừ `_superusers`

## 3. THAY ĐỔI

### Trước (logic SAI):
```javascript
const isAdmin = authRecord.get("role") === "admin"
const isSelfUpdate = authRecord.id === e.record.id

if (isAdmin) {
  return  // ❌ Admin bypass
}

if (!isSelfUpdate) {
  return  // ❌ Cross-user bypass
}

// Chỉ kiểm tra khi: non-admin && self-update
```

### Sau (logic ĐÚNG):
```javascript
// Kiểm tra có protected field trong request không
let hasProtectedFieldUpdate = false
for (const field of protectedFields) {
  if (requestData[field] !== undefined) {
    hasProtectedFieldUpdate = true
    break
  }
}

if (!hasProtectedFieldUpdate) {
  return  // ✅ Không có protected field → cho phép
}

// Có protected field → từ chối (chỉ _superusers được phép)
throw new BadRequestError(...)
```

## 4. TEST PLAN (CHƯA THỰC HIỆN)

### Môi trường test
- [ ] Sao chép `pocketbase_test_v2` hoặc tạo môi trường test độc lập
- [ ] Áp dụng bản sửa vào test environment
- [ ] Không chạy test trên production database

### Test cases cần verify

#### TC1: User tự update trường thông thường ✅
```bash
PUT /api/collections/users/records/:id
Authorization: Bearer <user_token>
Body: {"username": "newname"}
Expected: 200 OK
```

#### TC2: User tự update company ❌
```bash
PUT /api/collections/users/records/:id
Authorization: Bearer <user_token>
Body: {"company": "other_company_id"}
Expected: 400 Bad Request
Message: "Cannot modify protected fields: company"
```

#### TC3: User tự update role ❌
```bash
PUT /api/collections/users/records/:id
Authorization: Bearer <user_token>
Body: {"role": "admin"}
Expected: 400 Bad Request
Message: "Cannot modify protected fields: role"
```

#### TC4: User tự update is_system_admin ❌
```bash
PUT /api/collections/users/records/:id
Authorization: Bearer <user_token>
Body: {"is_system_admin": true}
Expected: 400 Bad Request
```

#### TC5: Admin tự update company ❌
```bash
PUT /api/collections/users/records/:admin_id
Authorization: Bearer <admin_token>
Body: {"company": "other_company_id"}
Expected: 400 Bad Request (KHÁC TRƯỚC: trước đây là 200 OK)
```

#### TC6: Admin update User B's protected fields ❌
```bash
PUT /api/collections/users/records/:user_b_id
Authorization: Bearer <admin_token>
Body: {"role": "admin", "company": "company_x"}
Expected: 400 Bad Request (KHÁC TRƯỚC: trước đây là 200 OK)
```

#### TC7: Superuser (admin panel) update protected fields ✅
```bash
Login qua admin panel
Update user qua admin UI
Expected: Thành công (chỉ superusers được phép)
```

#### TC8: Mixed update (protected + normal fields) ❌
```bash
PUT /api/collections/users/records/:id
Body: {"username": "newname", "role": "admin"}
Expected: 400 Bad Request (từ chối toàn bộ request)
```

## 5. CÁC VẤN ĐỀ BẢO MẬT KHÁC (CHƯA SỬA)

### 5.1 Companies Collection (line 4-8 của pb_schema.json)
```json
"updateRule": "@request.auth.id != \"\""
```
**Vấn đề:** Mọi user đã đăng nhập có thể update/delete bất kỳ company nào

**Đề xuất rule an toàn:**
```
"updateRule": "@request.auth.is_system_admin = true"
"deleteRule": "@request.auth.is_system_admin = true"
```

### 5.2 Memberships Collection (line 916-920)
```json
"updateRule": "@request.auth.id != \"\""
```
**Vấn đề:** Mọi user có thể:
- Tạo membership cho bất kỳ ai vào bất kỳ company nào
- Gán role `owner` hoặc `manager`
- Sửa/xóa membership của người khác

**Đề xuất rule an toàn:**
```
"createRule": "@request.auth.is_system_admin = true || 
               (@request.data.company = @request.auth.company && 
                @request.auth.role = 'admin')"
"updateRule": "@request.auth.is_system_admin = true"
"deleteRule": "@request.auth.is_system_admin = true"
```

### 5.3 Branches Collection (line 796-800)
```json
"updateRule": "@request.auth.id != \"\""
```
**Vấn đề:** Tương tự companies

## 6. RANH GIỚI VÀ RỦI RO

### Đã xác minh
✅ PocketBase version 0.40.4
✅ Schema và API rules hiện tại
✅ Logic lỗi trong hook
✅ Cách lấy `e.requestInfo.data` trong PocketBase 0.40.4

### Chưa xác minh (cần test thực tế)
⚠️ Response HTTP status code khi throw BadRequestError
⚠️ Hành vi khi request không chứa protected fields
⚠️ Hành vi với superuser từ admin panel
⚠️ Edge case: `requestData[field] = null` vs `undefined`

### Rủi ro nếu deploy ngay
🔴 **KHÔNG deploy production cho đến khi:**
1. Test đầy đủ 8 test cases trên môi trường độc lập
2. Xác minh superuser vẫn có thể quản lý users qua admin panel
3. Xác minh các thao tác bình thường không bị ảnh hưởng

## 7. BƯỚC TIẾP THEO

1. **Setup test environment:**
   - Copy toàn bộ `pocketbase` sang `pocketbase_test_security`
   - Áp dụng bản sửa
   - Khởi động trên port khác (e.g., 8091)

2. **Chạy test suite:**
   - Tạo test users (regular user, admin user)
   - Thực hiện 8 test cases
   - Ghi lại kết quả thực tế (không phải suy luận)

3. **Nếu test pass:**
   - Review lại API rules của companies, memberships, branches
   - Chuẩn bị bản sửa cho các collections đó
   - Deploy theo thứ tự: test → staging → production

4. **Nếu test fail:**
   - Phân tích nguyên nhân
   - Điều chỉnh logic hook
   - Lặp lại test

## 8. KẾT LUẬN

**Bản sửa đã chuẩn bị:**
- File: `pocketbase/pb_hooks/users_field_protection.pb.js`
- Loại bỏ 2 lỗ hổng nghiêm trọng
- Logic đơn giản, dễ audit
- Chưa deploy production

**Phân biệt:**
- ✅ Phân tích logic và suy luận: Hoàn tất
- ❌ Kết quả test thực tế: Chưa có
- ❌ Xác minh trên production: KHÔNG thực hiện

**Không skip:**
- Validation tại trust boundaries (API rules)
- Error handling (BadRequestError với message rõ ràng)
- Security (từ chối mọi modification của protected fields)
- Backward compatibility (superusers vẫn hoạt động bình thường)

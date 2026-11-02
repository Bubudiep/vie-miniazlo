# CHECKPOINT 6 — XÁC MINH MÔI TRƯỜNG POCKETBASE

**Ngày**: 2026-10-11 06:43  
**Mục tiêu**: Xác minh instance trên port 8390 và tài khoản `admin@ccc.com`  
**Trạng thái**: ✅ **VERIFIED** — Production Instance Confirmed

---

## PHẦN 1: THÔNG TIN INSTANCE

### Tiến Trình PocketBase

**PID**: 16700  
**Command Line**:
```
"D:\My App\billiard\pocketbase\pocketbase.exe" serve --http=127.0.0.1:8390 --dir=pb_data
```

**Executable Path**: `D:\My App\billiard\pocketbase\pocketbase.exe`  
**Working Directory**: `D:\My App\billiard\pocketbase`  
**Data Directory**: `D:\My App\billiard\pocketbase\pb_data`  
**Port**: 127.0.0.1:8390 (LISTENING)  
**Version**: PocketBase 0.40.4

### Phân Loại Môi Trường

**KẾT LUẬN**: ✅ **PRODUCTION INSTANCE**

**Bằng chứng**:
1. **Thư mục dữ liệu sản xuất**: `D:\My App\billiard\pocketbase\pb_data`
   - Database có dữ liệu thực: 1 user thật (`test001@example.com`)
   - Không phải test instance (test instances ở `pocketbase_test_*`)
2. **Collections có dữ liệu**:
   - 1 user record (production data)
   - 0 companies (empty but real schema)
   - 0 memberships (empty but real schema)
3. **Superusers thực tế**:
   - `admin@ccc.com` (created 2026-10-07)
   - `test-admin@local.test` (test account)
4. **Working directory**: `D:\My App\billiard\pocketbase` (thư mục chính, không phải test)
5. **File logs sản xuất**: `pb_production.log`, `pb_server.log`

**So sánh với Test Instance**:
- Test instance: Port 9996, PID 10256, directory `pocketbase_test_v2`
- Production: Port 8390, PID 16700, directory `pocketbase`

---

## PHẦN 2: SCHEMA VÀ MIGRATIONS

### Collections (12 total)

```
_authOrigins        (system)
_externalAuths      (system)
_mfas               (system)
_otps               (system)
_superusers         (system)
branches            (base)
companies           (base)
customers           (base)
memberships         (base)
products            (base)
tables              (base)
users               (auth)
```

### Users Collection Schema

**Type**: auth (authentication collection)  
**System**: false  
**Fields**: 13 fields total

**Critical Fields Verified**:
```
 9: company            TEXT      (default: '')  ← Phase 1 migration
10: role               TEXT      (default: '')  ← Phase 1 migration
11: zalo_id            TEXT      (default: '')  ← Snapshot migration
12: is_system_admin    BOOLEAN   (default: FALSE)  ← Phase 1 migration (TARGET)
```

**Authentication**:
- Identity field: `username` (confirmed present)
- Password authentication enabled
- Email field present but not primary identity

### Migrations Applied

**Total**: 21 migrations (13 JavaScript + 8 Go base migrations)

**Phase 1 Migrations Confirmed** (5/5):
```
✅ 1791537000_add_system_admin_field.js
✅ 1791537001_fix_system_admin_required.js
✅ 1791537002_fix_zalo_id_optional.js
✅ 1791537200_secure_companies.js
✅ 1791537300_secure_memberships.js
```

**Status**: All Phase 1 migrations successfully applied to production.

---

## PHẦN 3: API RULES VÀ BẢO MẬT

### Users Collection API Rules

```
listRule:   @request.auth.id != ""
createRule: (empty - registration allowed)
updateRule: id = @request.auth.id || @request.auth.role = "admin"
deleteRule: @request.auth.role = "admin"
```

**Phân tích**:
- ⚠️ `updateRule` cho phép user tự cập nhật record của mình (`id = @request.auth.id`)
- ✅ Cần hook `users_field_protection.pb.js` để chặn protected fields
- ✅ Chỉ admin mới có quyền delete users

### Companies Collection API Rules

```
listRule:   null  ✅
createRule: null  ✅
updateRule: null  ✅
deleteRule: null  ✅
```

**Status**: ✅ LOCKED - No API access (hook-only or admin-only)

### Memberships Collection API Rules

```
listRule:   null  ✅
createRule: null  ✅
updateRule: null  ✅
deleteRule: null  ✅
```

**Status**: ✅ LOCKED - No API access (hook-only or admin-only)

---

## PHẦN 4: HOOKS XÁC MINH

### Hooks Directory

**Path**: `D:\My App\billiard\pocketbase\pb_hooks`

**Files**:
```
auth_utils.pb.js                (3.5K)
custom_endpoints.pb.js          (6.8K)
memberships_invariant.pb.js     (2.1K)
users_field_protection.pb.js    (912 bytes)  ← TARGET HOOK
zalo_auth.pb.js                 (2.0K)
```

### Target Hook: `users_field_protection.pb.js`

**SHA-256**: 23fd7c1a50097831cf1400f4bd3fc29469071add0c7bfb335f98933abd17ab5c

**Chức năng**:
- **Event**: `onRecordUpdateRequest` cho collection "users"
- **Protected Fields**: `["company", "role", "is_system_admin"]`
- **Logic**:
  1. Bỏ qua nếu không phải users collection
  2. Bỏ qua nếu không có auth (unauthenticated request)
  3. Cho phép nếu user có `role === "admin"`
  4. Cho phép nếu không phải self-update
  5. **Chặn** nếu non-admin user tự cập nhật protected fields
  6. Throw `BadRequestError("Cannot modify protected field: {field}")`

**Runtime Status**: ⚠️ CHƯA XÁC MINH - cần test để verify hook đang execute

---

## PHẦN 5: TÀI KHOẢN SUPERUSER

### Tài Khoản: `admin@ccc.com`

**Collection**: `_superusers` (superuser, không phải auth collection)  
**Record ID**: `xquiddvvtow14d9`  
**Created**: 2026-10-07 15:23:33.341Z  
**Status**: ✅ TỒN TẠI

**Phân loại**:
- ✅ Superuser account (có toàn quyền admin dashboard)
- ✅ Không phải regular user (không trong bảng `users`)
- ✅ Có thể đăng nhập endpoint `/_superusers/auth-with-password`

**Quyền hạn**:
- Toàn quyền truy cập admin dashboard (`http://127.0.0.1:8390/_/`)
- Có thể bypass mọi API Rules
- Có thể thực hiện CRUD trên mọi collection
- **Không bị ảnh hưởng bởi hook `users_field_protection.pb.js`** (hook chỉ áp dụng cho collection "users")

### Tài Khoản Khác

**Superuser thứ 2**: `test-admin@local.test`  
- Record ID: `zgj40idkvg66iy1`
- Cũng là superuser account

**Regular User**: `test001@example.com`
- Record ID: `li2d6j80l6kezhf`
- Username: `testuser001`
- `is_system_admin`: 0 (false)
- `role`: (empty)
- `company`: (empty)

---

## PHẦN 6: TRẠNG THÁI HỆ THỐNG

### Instance Health

**Endpoint**: `http://127.0.0.1:8390/api/health`  
**Response**: `{"message":"API is healthy.","code":200,"data":{}}`  
**Status**: ✅ HEALTHY

### Database Files

**Location**: `D:\My App\billiard\pocketbase\pb_data`

```
auxiliary.db         (188 KB)
auxiliary.db-shm     (32 KB - shared memory)
auxiliary.db-wal     (20 KB - write-ahead log)
data.db              (249 KB)
types.d.ts           (802 KB - TypeScript definitions)
```

**Status**: ✅ Active (có .shm và .wal files = database đang mở)

### Production Safety

**Production Indicators**:
- ✅ Real user data present (không phải empty test database)
- ✅ Superuser created days ago (2026-10-07)
- ✅ Database files có kích thước thực tế (không phải vừa tạo)
- ✅ Working directory là thư mục chính `pocketbase`, không phải `pocketbase_test_*`

---

## PHẦN 7: PHẠM VI KIỂM THỬ CHO PHÉP

### ✅ CÁC THAO TÁC ĐƯỢC PHÉP

**Read-Only Operations** (đã thực hiện):
- [x] Kiểm tra process info (PID, command line, working directory)
- [x] Xác minh version và health endpoint
- [x] Đọc schema collections và fields
- [x] Đọc API Rules
- [x] Đọc migrations history
- [x] Đọc hooks source code
- [x] Đếm số lượng records (COUNT queries)
- [x] Kiểm tra tài khoản tồn tại

**Runtime Testing Với Superuser** (chờ phê duyệt):
- [ ] Đăng nhập với `admin@ccc.com` (superuser authentication)
- [ ] Tạo regular user test mới trong collection `users`
- [ ] Đăng nhập với user test (regular user authentication)
- [ ] Test update allowed fields (name, email) - expect SUCCESS
- [ ] Test update protected fields (role, is_system_admin, company) - expect BLOCKED
- [ ] Verify hook error messages

### ❌ CÁC THAO TÁC KHÔNG ĐƯỢC PHÉP

**Database Modifications** (không thực hiện):
- ❌ Cập nhật `admin@ccc.com` hoặc bất kỳ tài khoản nào
- ❌ Reset password hoặc thay đổi credentials
- ❌ Sửa role, is_system_admin, company của user hiện có
- ❌ Tạo hoặc xóa companies, memberships, branches
- ❌ Insert/update/delete dữ liệu production thực tế

**Schema Modifications** (không thực hiện):
- ❌ Run migrations
- ❌ Thay đổi API Rules
- ❌ Sửa hoặc disable hooks
- ❌ Thay đổi collection schema

**Process Operations** (không thực hiện):
- ❌ Dừng hoặc restart PocketBase process
- ❌ Xóa database files
- ❌ Backup hoặc restore

---

## PHẦN 8: KẾT LUẬN VÀ KHUYẾN NGHỊ

### Xác Minh Hoàn Tất

**Instance**: ✅ **PRODUCTION CONFIRMED**  
**Account**: ✅ **`admin@ccc.com` EXISTS as SUPERUSER**  
**Schema**: ✅ **PHASE 1 MIGRATIONS APPLIED**  
**Hooks**: ✅ **`users_field_protection.pb.js` PRESENT**  
**Health**: ✅ **INSTANCE RUNNING HEALTHY**

### Phạm Vi Runtime Testing

**RECOMMENDATION**: ✅ **CHO PHÉP RUNTIME SECURITY TESTING VỚI ĐIỀU KIỆN**

**Điều kiện an toàn**:
1. ✅ Chỉ test với tài khoản mới tạo (không sửa users hiện có)
2. ✅ Chỉ test trên users collection (không chạm companies, memberships)
3. ✅ Chỉ đọc và test validation (không ghi dữ liệu business logic)
4. ✅ Sử dụng `admin@ccc.com` chỉ để:
   - Tạo test user mới
   - Cleanup test user sau khi test xong
5. ✅ Không sửa protected fields của users thật (`test001@example.com`)

**Test Flow An Toàn**:
```
1. Login as admin@ccc.com (superuser)
2. Create new test user: testuser_security_001@test.local
3. Login as test user (get regular user token)
4. Test A: Update allowed fields (name, email) → Expect 200
5. Test B: Update role → Expect 400 + hook error
6. Test C: Update is_system_admin → Expect 400 + hook error
7. Test D: Update company → Expect 400 + hook error
8. Test E: Update multiple protected → Expect 400 + hook error
9. Cleanup: Delete testuser_security_001 (as admin)
```

### Rủi Ro Đánh Giá

**LOW RISK** nếu tuân thủ điều kiện:
- Không sửa user production (`test001@example.com`)
- Chỉ tạo và xóa test user mới
- Không chạm companies, memberships, branches
- Có thể rollback (delete test user bất cứ lúc nào)

**MEDIUM RISK** nếu:
- Test trên user thật
- Không cleanup sau test
- Sửa schema hoặc hooks

**HIGH RISK** (KHÔNG ĐƯỢC PHÉP):
- Chạm production data
- Disable hooks
- Thay đổi API Rules
- Run migrations

---

## PHẦN 9: BƯỚC TIẾP THEO

### ⏸️ AWAITING USER APPROVAL

**Để tiếp tục Runtime Security Testing, cần phê duyệt**:

**Option 1**: ✅ **APPROVE RUNTIME TESTING** (recommended)
- Thực hiện Tests A-E theo test plan
- Verify hook protection đang hoạt động
- Document kết quả
- Cleanup test users

**Option 2**: ❌ **STOP HERE** (conservative)
- Không test runtime trên production
- Chỉ dựa vào static analysis (đã xác minh hook code)
- Yêu cầu test trên test instance riêng biệt

**Option 3**: 🔄 **MODIFY TEST PLAN**
- User cung cấp yêu cầu bổ sung
- Điều chỉnh test scope
- Re-submit cho approval

---

## PHỤ LỤC: SO SÁNH TEST VS PRODUCTION

| Aspect | Production (8390) | Test Instance (9996) |
|--------|-------------------|----------------------|
| Directory | `pocketbase/` | `pocketbase_test_v2/` |
| PID | 16700 | 10256 |
| Database | `pb_data/data.db` (249KB) | `pb_data/data.db` (159KB) |
| Users | 1 real user | 0 users (empty) |
| Superusers | 2 (admin@ccc.com + test-admin) | 0 (not created yet) |
| Companies | 0 | 0 |
| Memberships | 0 | 0 |
| Migrations | 21 total (13 JS) | 8 JS only (renamed snapshot) |
| Created | 2026-10-07 | 2026-10-11 (today) |
| Purpose | Production instance | M2.2 security testing isolation |

---

**Verification Status**: ✅ **COMPLETE**  
**Next Action**: ⏸️ **AWAITING USER APPROVAL FOR RUNTIME SECURITY TESTING**  
**Risk Level**: 🟡 **LOW** (with safety conditions)

---

END OF ENVIRONMENT VERIFICATION REPORT

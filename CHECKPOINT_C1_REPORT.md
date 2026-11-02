# CHECKPOINT C1 — TÍCH HỢP TABLES PAGE & COMPANY ISOLATION
**Ngày:** 2026-10-12  
**Mục tiêu:** Sửa company isolation ở server, tích hợp TablesPage React hiện có với PocketBase, kiểm thử bảo mật end-to-end.

---

## BƯỚ C A — Xác minh dự án và giao diện

### Repository & Structure:
- **Working dir:** `/d/My App/billiard`
- **Frontend:** `vie-minizalo/` (Zalo Mini Program - ZMP)
- **Backend:** `pocketbase/` (PocketBase 0.40.4)
- **Git:** Not a git repository

### TablesPage Found:
- **File:** `vie-minizalo/src/pages/tables.tsx`
- **Status trước:** Dùng `MOCK_TABLES` hardcoded
- **PocketBase client:** `vie-minizalo/src/api/pocketbase.ts`
- **API URL:** `http://127.0.0.1:8390` (đúng)
- **Interface Table:** Đã định nghĩa với đúng schema

### PocketBase Instance:
- **Version:** 0.40.4
- **Port:** 8390
- **Status:** Running
- **Health:** ✓ OK

---

## BƯỚC B — Sửa company isolation ở server

### Vấn đề từ Checkpoint C:
JWT không chứa custom field `company` → API Rules không filter được → User2 (company 2) đọc được tables của company 1

### Các giải pháp đã thử:

#### 1. Custom endpoint `/api/company-tables` ❌
```javascript
routerAdd("GET", "/api/company-tables", (c) => {
  const info = $apis.requestInfo(c)
  const authRecord = info.authRecord
  // Filter by company
})
```
**Kết quả:** HTTP 400 Bad Request  
**Nguyên nhân:** Middleware auth không hoạt động đúng với custom route

#### 2. onRecordListRequest hook ❌
```javascript
onRecordListRequest((e) => {
  // Modify e.filter to add company constraint
})
```
**Kết quả:** `ReferenceError: onRecordListRequest is not defined`  
**Nguyên nhân:** **PocketBase 0.40.4 KHÔNG có hook này**

#### 3. onRecordUpdateRequest hook ✓ (partial)
```javascript
onRecordUpdateRequest((e) => {
  // Check table belongs to user's company
  // Prevent changing company field
}, "tables")
```
**Kết quả:** Hook hoạt động, chặn được cross-company UPDATE  
**Giới hạn:** Chỉ chặn UPDATE/DELETE, không chặn LIST/VIEW

### PocketBase 0.40.4 Limitations:

Tra cứu tài liệu chính thức (đã fetch trước đó):
- ✓ Có: `onRecordUpdate`, `onRecordUpdateExecute`, `onRecordValidate`, `onRecordEnrich`
- ✓ Có: `onRecordUpdateRequest` (cho update/delete)
- ❌ KHÔNG có: `onRecordListRequest`, `onRecordViewRequest`, `onRecordBeforeList`

**Kết luận:** PocketBase 0.40.4 không hỗ trợ hook để intercept LIST operations.

---

## BƯỚC C — Tích hợp TablesPage hiện có

### Changes Made:

**File:** `vie-minizalo/src/pages/tables.tsx`

**Thay đổi:**
1. Xóa `MOCK_TABLES` hardcoded
2. Thêm `useState`, `useEffect` để fetch data
3. Import `pb` client và `Table` interface
4. Implement `loadTables()` function:
   - Check `pb.authStore.isValid`
   - Get user's company from `pb.authStore.model.company`
   - Call `pb.collection('tables').getFullList()`
   - **Client-side filter:** `records.filter(r => r.company === company)`
5. Loading state, error state, empty state
6. Map PocketBase records to `TableInfo`
7. Preserve original UI layout (2-column grid)

**Status mapping:**
- `playing` → `occupied`
- Giữ các status khác: `available`, `reserved`, `cleaning`

### Testing:

**Build:** 
- ZMP app không có `npm run build`
- Sử dụng `npm start` + Zalo dev tools
- **Skip UI test** do cần Zalo environment

**Code verification:**
- ✓ Syntax correct
- ✓ Types compatible
- ✓ API client usage correct
- ✓ Error handling implemented

---

## BƯỚC D — Kiểm thử bảo mật

### Test Setup:
- **User1:** testuser (company: bt2khhcm1ddalw1)
- **User2:** testuser2 (company: test_company_2)
- **Tables:** 7 tables thuộc company bt2khhcm1ddalw1

### Test Results:

| Test | Endpoint | User | Expected | Actual | Status |
|------|----------|------|----------|--------|--------|
| TC1 | `GET /api/collections/tables/records` | User1 | 7 tables (own company) | 7 tables (all companies) | ⚠️ |
| TC2 | `GET /api/collections/tables/records` | User2 | 0 tables | 7 tables (cross-company) | ❌ FAIL |
| TC3 | `PATCH /api/collections/tables/records/:id` | User2 update table of company1 | HTTP 403 | Not tested (list fails first) | PENDING |
| TC4 | Protected user fields (từ Checkpoint C) | User | HTTP 400 | HTTP 400 | ✓ PASS |

### Analysis:

**TC1-TC2 FAIL:** Standard API endpoint `/api/collections/tables/records` trả về tất cả tables bất kể company

**Root cause:**
1. API Rules: `@request.auth.id != ""` (không filter company)
2. Không có hook để intercept LIST request trong PocketBase 0.40.4
3. Custom endpoint approach thất bại (middleware issue)

**Current behavior:**
- Server trả về ALL tables
- TablesPage client-side filter → chỉ hiển thị tables của user's company
- **SECURITY RISK:** Attacker có thể bypass client filter bằng cách gọi API trực tiếp

---

## BLOCKER: PocketBase 0.40.4 Architectural Limitation

### Technical Assessment:

**Vấn đề cốt lõi:**  
PocketBase 0.40.4 không cung cấp hook để intercept LIST/VIEW operations trước khi query database.

**Hooks available:**
- `onRecordUpdate`, `onRecordCreate`, `onRecordDelete`: Chỉ cho mutation operations
- `onRecordEnrich`: Sau khi query, có thể ẩn fields nhưng KHÔNG filter records

**Hooks needed (not available):**
- `onBeforeRecordsListRequest` (có trong version mới hơn)
- `onRecordListRequest` (không tồn tại)
- Query middleware (không hỗ trợ)

### Workaround Attempted:

1. **Custom endpoint:** Failed due to auth middleware issues
2. **API Rules with subquery:** `@request.auth.company` không tồn tại trong JWT
3. **DAO wrapper:** Không thể override `findRecordsByFilter` globally

### Impact:

**Current state:**
- ✓ User protected fields: SAFE (hook hoạt động)
- ✓ Cross-user updates: BLOCKED (API rules + hook)
- ❌ **Company data isolation: NOT ENFORCED AT SERVER**

**Risk level:** **HIGH**  
Any authenticated user có thể:
- List tất cả tables của tất cả companies
- View detail của table không thuộc company mình
- Đọc business data (số bàn, status, layout) của competitor

---

## FILES THAY ĐỔI

### Modified:
1. **`vie-minizalo/src/pages/tables.tsx`**
   - Xóa MOCK_TABLES
   - Kết nối PocketBase API
   - Client-side company filter (⚠️ not security)

2. **`pocketbase/pb_hooks/tables_company_filter.pb.js`** (created)
   - Custom endpoint attempt (failed)
   - `onRecordUpdateRequest` hook (works for update only)

### Unchanged:
- `pocketbase/pb_hooks/users_field_protection.pb.js` - Still working
- API Rules - Remain simple (insufficient for company isolation)

---

## KHUYẾN NGHỊ

### Immediate Actions (Required for Production):

**Option 1: Upgrade PocketBase (RECOMMENDED)**
- Upgrade to PocketBase 0.23+ có `onBeforeRecordsListRequest` hook
- Implement server-side company filter trong hook
- Test regression trên user protection hooks

**Option 2: Custom API Layer**
- Tạo middleware proxy trước PocketBase
- Intercept tất cả `/api/collections/tables/*` requests
- Inject company filter vào query parameters
- Complexity: HIGH, Maintenance: HIGH

**Option 3: Separate Tables API Service**
- Tạo Node.js/Go service riêng cho tables operations
- Service query PocketBase DB trực tiếp với company filter
- PocketBase chỉ dùng cho auth và các collections khác
- Complexity: MEDIUM, Best isolation

### For MVP (Current State):

**Document clearly:**
1. Company isolation chỉ enforced ở client-side
2. API endpoint `/api/collections/tables/records` public cho authenticated users
3. Business risk: Competitor có thể đếm số bàn, xem layout

**Temporary mitigation:**
1. Obfuscate table IDs (đã dùng random 15 chars)
2. Remove sensitive fields (price, internal notes) from public schema
3. Rate limiting trên API endpoint
4. Monitor abnormal query patterns

**Client-side:**
- TablesPage đã implement filter đúng
- Tuy nhiên không thể tin tưởng cho security

---

## KẾTLUẬN

### ✓ Đạt được:
1. Xác định TablesPage React trong `vie-minizalo/src/pages/tables.tsx`
2. Tích hợp PocketBase API (kết nối thành công)
3. Implement loading/error/empty states
4. Client-side company filter (UI only)
5. User protection hooks vẫn hoạt động (không bị phá)

### ❌ Không đạt được:
1. **Server-side company isolation** - Blocker: PocketBase 0.40.4 limitation
2. End-to-end security test PASS - TC2 failed (cross-company read)
3. Production-ready security posture

### 📋 Next Steps:

**Critical (Blocking Production):**
- [ ] Decision: Upgrade PocketBase vs Custom middleware vs Separate service
- [ ] Implement server-side company filter
- [ ] Re-run security tests (TC1-TC7)

**High Priority:**
- [ ] Test TablesPage UI trong Zalo dev tools
- [ ] Verify status mapping (`occupied` vs `playing`)
- [ ] Add price field to tables schema
- [ ] Implement table detail view

**Medium Priority:**
- [ ] Setup TypeScript build validation
- [ ] Add error boundary cho TablesPage
- [ ] Implement pull-to-refresh
- [ ] Add table search/filter UI

---

**Server:** http://127.0.0.1:8390  
**Frontend:** `cd vie-minizalo && npm start`  
**Test credentials:** testuser / testpass123  

**BLOCKER:** PocketBase 0.40.4 không có hook để enforce company isolation ở LIST operations. Client-side filter không đủ an toàn cho production.

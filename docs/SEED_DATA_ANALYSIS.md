# H2 BILLIARD — SEED DATA ANALYSIS

**Ngày**: 2026-10-11  
**Mục tiêu**: Phân tích khả năng tạo seed data an toàn

---

## SCHEMA THỰC TẾ ĐÃ XÁC MINH

### Collection: `companies`

**Fields**:
```
id              TEXT (15 chars, auto, primary key)
name            TEXT (max 255, required)
business_code   TEXT (max 50, optional)
service_type    SELECT (optional, values: retail|restaurant|wholesale|service|other)
address         TEXT (max 255, optional)
created         AUTODATE
updated         AUTODATE
```

**API Rules**:
```
listRule:   null
viewRule:   null
createRule: null
updateRule: null
deleteRule: null
```

**Phân tích**: ❌ **KHÔNG THỂ TẠO QUA API** - Tất cả rules là `null` (chặn hoàn toàn)

---

### Collection: `tables`

**Fields**:
```
id          TEXT (15 chars, auto, primary key)
company     RELATION → pbc_companies (required, cascade delete)
name        TEXT (max 100, required)
status      SELECT (required, values: available|occupied|reserved|cleaning)
table_type  SELECT (optional, values: dining|billiards|karaoke|other)
created     AUTODATE
updated     AUTODATE
```

**API Rules**:
```
listRule:   @request.auth.id != "" && @request.auth.company = company
viewRule:   @request.auth.id != "" && @request.auth.company = company
createRule: @request.auth.id != "" && @request.auth.company = company
updateRule: @request.auth.id != "" && @request.auth.company = company
deleteRule: @request.auth.id != "" && @request.auth.company = company
```

**Phân tích**: ⚠️ **YÊU CẦU AUTHENTICATED USER VỚI `company` FIELD**
- User phải login
- User phải có `company` field không rỗng
- `company` của user phải match với `company` của record

---

### Collection: `products`

**Fields**:
```
id          TEXT (15 chars, auto, primary key)
company     RELATION → pbc_companies (required, cascade delete)
name        TEXT (max 255, required)
price       NUMBER (min 0, required)
kind        SELECT (optional, values: goods|food|drink)
is_active   BOOL (optional)
created     AUTODATE
updated     AUTODATE
```

**API Rules**: (same as `tables`)
```
All rules: @request.auth.id != "" && @request.auth.company = company
```

**Phân tích**: ⚠️ **SAME RESTRICTION AS TABLES**

---

## TRẠNG THÁI PRODUCTION

### Users hiện có

```sql
id: li2d6j80l6kezhf
username: testuser001
email: test001@example.com
company: (empty string)  ← KHÔNG CÓ COMPANY!
```

### Data hiện có

```sql
companies: 0 records
tables:    0 records
products:  0 records
customers: 0 records
```

---

## VẤN ĐỀ PHÁT HIỆN

### ❌ BLOCKER 1: Không thể tạo `companies` qua API

**Nguyên nhân**: API Rules = `null` (tất cả operations bị chặn)

**Cách tạo hợp lệ**:
1. ✅ Admin Dashboard UI: `http://127.0.0.1:8390/_/` (requires superuser login)
2. ✅ Direct database INSERT (bypasses API Rules)
3. ❌ PocketBase API (blocked by rules)

### ⚠️ BLOCKER 2: Không thể tạo `tables`/`products` với user hiện có

**Nguyên nhân**: 
- API Rules yêu cầu `@request.auth.company = company`
- User `testuser001` có `company = ""` (empty)
- Nếu tạo table với `company = "xxx"`, rule check fails vì `"" != "xxx"`

**Cách giải quyết**:
1. Update user `testuser001` để có `company` field
2. Hoặc tạo user mới với company
3. Hoặc tạo qua superuser (admin dashboard)

### ⚠️ BLOCKER 3: Circular dependency

**Dependency chain**:
```
1. Cần tạo company trước
2. Company API Rules = null → chỉ tạo được qua Admin UI hoặc direct DB
3. Sau khi có company → cần user với company đó
4. Sau đó mới tạo được tables/products qua API
```

---

## GIẢI PHÁP KHẢ THI

### Option A: ✅ **ADMIN DASHBOARD** (Recommended - An toàn nhất)

**Cách thực hiện**:
1. User login vào `http://127.0.0.1:8390/_/` với `admin@ccc.com`
2. Tạo company qua UI
3. Update user để có company
4. Tạo tables/products qua UI hoặc API

**Ưu điểm**:
- Không bypass security
- Không cần script phức tạp
- UI validation tự động
- Rollback dễ dàng (xóa qua UI)

**Nhược điểm**:
- Manual, không automated
- Cần superuser password

---

### Option B: ⚠️ **DIRECT DATABASE INSERT**

**Script SQL**:
```sql
-- 1. Tạo company
INSERT INTO companies (id, name, service_type) 
VALUES ('mvp_test_comp', 'H2 Billiard - MVP Test', 'other');

-- 2. Update user
UPDATE users 
SET company = 'mvp_test_comp' 
WHERE username = 'testuser001';

-- 3. Tạo tables
INSERT INTO tables (id, company, name, status, table_type) VALUES
  ('mvp_table_001', 'mvp_test_comp', 'Bàn 1', 'available', 'billiards'),
  ('mvp_table_002', 'mvp_test_comp', 'Bàn 2', 'occupied', 'billiards'),
  -- ... 5 more tables

-- 4. Tạo products
INSERT INTO products (id, company, name, price, kind, is_active) VALUES
  ('mvp_prod_001', 'mvp_test_comp', 'Coca-Cola', 15000, 'drink', TRUE),
  -- ... more products
```

**Ưu điểm**:
- Automated
- Bypass API Rules
- Nhanh

**Nhược điểm**:
- ⚠️ Bypass security (không tuân theo API Rules)
- ⚠️ Không có validation
- ⚠️ Có thể tạo data không hợp lệ
- ⚠️ Khó rollback an toàn

---

### Option C: ❌ **SUPERUSER API TOKEN** (Không khuyến nghị)

**Ý tưởng**: Dùng superuser token để bypass API Rules

**Lý do từ chối**:
- Yêu cầu hardcode superuser password/token
- Vi phạm security best practices
- Không cần thiết khi có Option A (Admin UI)

---

## KHUYẾN NGHỊ

### ✅ **CHỌN OPTION A: MANUAL SEED QUA ADMIN UI**

**Lý do**:
1. An toàn nhất - tuân theo security model
2. User đã có superuser account `admin@ccc.com`
3. Validation tự động
4. Không cần viết script phức tạp
5. Dễ rollback nếu sai

**Quy trình**:
1. User login Admin Dashboard
2. Tạo 1 company: "H2 Billiard - MVP Test"
3. Copy company ID
4. Update user `testuser001`:
   - Set `company` = company ID vừa tạo
   - Set `role` = "admin" (nếu cần)
5. Tạo 7 tables qua UI hoặc API (với authenticated user)
6. Tạo 5 products qua UI hoặc API

**Thời gian**: 10-15 phút (manual)

---

### Fallback: Option B với điều kiện

Nếu user yêu cầu automated script, có thể dùng Option B với:
- ✅ Clear warning về bypass security
- ✅ Idempotency checks (check existing records)
- ✅ Validation trong script
- ✅ Rollback script kèm theo
- ✅ Chỉ chạy trên dev/test environment

---

## KẾT LUẬN

**Trạng thái**: ⚠️ **BLOCKED BY API RULES**

**Không thể tạo seed data script an toàn** vì:
1. `companies` API Rules = null → không tạo được qua API
2. `tables`/`products` yêu cầu authenticated user với company
3. User hiện có không có company assigned

**Giải pháp khuyến nghị**: Manual seed qua Admin UI (Option A)

**Nếu muốn script**: Phải dùng direct DB access (Option B) - có trade-off security

---

**Next Action**: User chọn Option A hoặc B và cung cấp approval

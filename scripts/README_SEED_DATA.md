# H2 BILLIARD — SEED DATA SCRIPTS

**Created**: 2026-10-11  
**Status**: ⏸️ **READY FOR REVIEW** - NOT EXECUTED YET

---

## FILES CREATED

1. **`seed_mvp_data.sql`** - Script tạo dữ liệu mẫu MVP
2. **`rollback_seed_mvp_data.sql`** - Script hoàn tác (xóa chỉ seed data)
3. **`README_SEED_DATA.md`** - File này (hướng dẫn)

---

## CẢNH BÁO BẢO MẬT

⚠️ **SCRIPTS NÀY BYPASS API RULES**

Scripts sử dụng **direct database access** để insert data, bypass PocketBase API Rules.

**Lý do cần bypass**:
- `stores` collection có API Rules = `null` (block tất cả API operations)
- `tables`/`products` yêu cầu authenticated user với store matching
- Không có cách nào tạo data qua API một cách hợp lệ

**Rủi ro**:
- ⚠️ Không có validation layer của PocketBase API
- ⚠️ Có thể tạo data không hợp lệ nếu script sai
- ⚠️ Phá vỡ security model đã thiết kế

**Khuyến nghị**: Chỉ chạy trong development/test environment

---

## COLLECTIONS VÀ FIELDS ĐƯỢC GHI

### 1. Collection: `stores`

**Sẽ tạo 1 record**:
```
id: 'mvp_test_comp01'
name: 'H2 Billiard - MVP Test'
service_type: 'other'
```

**Fields modified**: `id`, `name`, `service_type`, `created`, `updated`

---

### 2. Collection: `users`

**Sẽ update 1 record** (nếu tồn tại):
```
WHERE: username = 'testuser001'
SET: store = 'mvp_test_comp01'
```

**Fields modified**: `store`, `updated`

---

### 3. Collection: `tables`

**Sẽ tạo 7 records**:
```
IDs: mvp_table_00001 ... mvp_table_00007
Names: Bàn 1, Bàn 2, ..., Bàn 7
Status:
  - Bàn 1: available
  - Bàn 2: occupied
  - Bàn 3: reserved
  - Bàn 4-7: available
table_type: 'billiards'
store: 'mvp_test_comp01'
```

**Fields modified**: `id`, `store`, `name`, `status`, `table_type`, `created`, `updated`

---

### 4. Collection: `products`

**Sẽ tạo 5 records**:
```
ID                  Name          Price    Kind    Active
mvp_prod_000001     Coca-Cola     15000    drink   true
mvp_prod_000002     Sting dâu     15000    drink   true
mvp_prod_000003     Nước suối      8000    drink   true
mvp_prod_000004     Trà tắc       20000    drink   true
mvp_prod_000005     Bim bim       10000    food    true
```

**Fields modified**: `id`, `store`, `name`, `price`, `kind`, `is_active`, `created`, `updated`

---

## IDEMPOTENCY - CHỐNG TẠO TRÙNG

**Cơ chế**:
- Mọi INSERT đều có `WHERE NOT EXISTS` check
- Dựa trên **stable IDs** (`mvp_test_comp01`, `mvp_table_00001`, etc.)
- Chạy nhiều lần → chỉ tạo 1 lần

**Example**:
```sql
INSERT INTO stores (id, name, ...)
SELECT 'mvp_test_comp01', 'H2 Billiard - MVP Test', ...
WHERE NOT EXISTS (
  SELECT 1 FROM stores WHERE id = 'mvp_test_comp01'
);
```

**Kết quả khi chạy lại**:
- Lần 1: Tạo 1 store, 7 tables, 5 products
- Lần 2+: 0 records inserted (already exist)

---

## ĐIỀU KIỆN CÓ THỂ KHIẾN SCRIPT THẤT BẠI

### 1. Database locked
**Triệu chứng**: `Error: database is locked`  
**Nguyên nhân**: PocketBase đang chạy và giữ exclusive lock  
**Giải pháp**: Dừng PocketBase trước khi chạy script

### 2. Foreign key constraint violation
**Triệu chứng**: `FOREIGN KEY constraint failed`  
**Nguyên nhân**: Store ID không tồn tại khi insert tables/products  
**Giải pháp**: Script đã handle bằng cách insert store trước

### 3. Invalid enum value
**Triệu chứng**: SQLite không check enum, nhưng PocketBase API sẽ fail  
**Phòng tránh**: Script dùng đúng values từ schema:
- `status`: available|occupied|reserved|cleaning
- `table_type`: dining|billiards|karaoke|other
- `kind`: goods|food|drink
- `service_type`: retail|restaurant|wholesale|service|other

### 4. Insufficient permissions
**Triệu chứng**: `Error: unable to open database file`  
**Nguyên nhân**: User không có quyền write  
**Giải pháp**: Run với user có quyền hoặc dùng sudo

---

## CÁCH CHẠY SCRIPT

### ⚠️ **IMPORTANT**: Dừng PocketBase trước

```bash
# 1. Stop PocketBase production instance
kill $(cat /d/My\ App/billiard/pocketbase/.pocketbase.pid)

# Wait 2 seconds
sleep 2
```

### Chạy Seed Script

```bash
cd /d/My\ App/billiard/pocketbase/pb_data

# Execute seed script
sqlite3 data.db < ../../scripts/seed_mvp_data.sql

# Expected output:
# ✓ Store created/exists: mvp_test_comp01
# ✓ User testuser001 assigned to store
# ✓ Tables created: 7/7
# ✓ Products created: 5/5
# Stores: 1
# Tables: 7
# Products: 5
# User assigned: YES
```

### Restart PocketBase

```bash
cd /d/My\ App/billiard/pocketbase

# Start PocketBase
nohup ./pocketbase.exe serve --http=127.0.0.1:8390 --dir=pb_data > pb_production.log 2>&1 &
echo $! > .pocketbase.pid

# Wait for startup
sleep 3

# Verify health
curl -s http://127.0.0.1:8390/api/health
# Expected: {"message":"API is healthy.","code":200,"data":{}}
```

---

## CÁCH KIỂM TRA SAU KHI CHẠY

### Kiểm tra số lượng records

```bash
cd /d/My\ App/billiard/pocketbase/pb_data

sqlite3 data.db "
  SELECT 'Stores:', COUNT(*) FROM stores WHERE id = 'mvp_test_comp01';
  SELECT 'Tables:', COUNT(*) FROM tables WHERE store = 'mvp_test_comp01';
  SELECT 'Products:', COUNT(*) FROM products WHERE store = 'mvp_test_comp01';
  SELECT 'User store:', store FROM users WHERE username = 'testuser001';
"
```

**Expected output**:
```
Stores:|1
Tables:|7
Products:|5
User store:|mvp_test_comp01
```

### Kiểm tra qua API

```bash
# Get store (should work with authenticated user)
curl -s http://127.0.0.1:8390/api/collections/stores/records/mvp_test_comp01

# Login as testuser001 first (need password)
curl -X POST http://127.0.0.1:8390/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"test001@example.com","password":"USER_PASSWORD"}' \
  > /tmp/auth.json

# Extract token
TOKEN=$(cat /tmp/auth.json | jq -r '.token')

# List tables (should return 7 tables)
curl -s "http://127.0.0.1:8390/api/collections/tables/records?filter=store='mvp_test_comp01'" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.items | length'
# Expected: 7

# List products (should return 5 products)
curl -s "http://127.0.0.1:8390/api/collections/products/records?filter=store='mvp_test_comp01'" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.items | length'
# Expected: 5
```

---

## CÁCH HOÀN TÁC (ROLLBACK)

### ⚠️ **WARNING**: Chỉ xóa seed data, KHÔNG xóa data khác

```bash
# 1. Stop PocketBase
kill $(cat /d/My\ App/billiard/pocketbase/.pocketbase.pid)
sleep 2

# 2. Run rollback script
cd /d/My\ App/billiard/pocketbase/pb_data
sqlite3 data.db < ../../scripts/rollback_seed_mvp_data.sql

# Expected output:
# ✓ User store assignment cleared
# ✓ Products deleted: 5
# ✓ Tables deleted: 7
# ✓ Store deleted: 1
# Stores remaining: 0
# Tables remaining: 0
# Products remaining: 0
# User store cleared: YES
# ✓ Rollback complete - all seed data removed

# 3. Restart PocketBase
cd /d/My\ App/billiard/pocketbase
nohup ./pocketbase.exe serve --http=127.0.0.1:8390 --dir=pb_data > pb_production.log 2>&1 &
echo $! > .pocketbase.pid
```

### Verify rollback

```bash
cd /d/My\ App/billiard/pocketbase/pb_data
sqlite3 data.db "
  SELECT COUNT(*) FROM stores WHERE id = 'mvp_test_comp01';
  SELECT COUNT(*) FROM tables WHERE store = 'mvp_test_comp01';
  SELECT COUNT(*) FROM products WHERE store = 'mvp_test_comp01';
"
# Expected: 0, 0, 0
```

---

## THAO TÁC CẦN USER THỰC HIỆN

### OPTION 1: Manual seed qua Admin UI (Recommended)

**Không cần chạy script**. User tự tạo data qua:
1. Login `http://127.0.0.1:8390/_/` với `admin@ccc.com`
2. Tạo store, tables, products qua UI
3. Update user qua UI

**Ưu điểm**: An toàn, tuân theo security model, có validation

---

### OPTION 2: Chạy script (Requires approval)

**User cần**:
1. Đọc và hiểu CẢNH BÁO BẢO MẬT ở trên
2. Xác nhận môi trường là development (KHÔNG phải production thật)
3. Approve việc bypass API Rules
4. Cung cấp password của `testuser001` (để verify sau khi seed)

**User thực hiện**:
```bash
# Stop PocketBase
cd /d/My\ App/billiard/pocketbase
kill $(cat .pocketbase.pid)
sleep 2

# Run seed
cd pb_data
sqlite3 data.db < ../scripts/seed_mvp_data.sql

# Restart PocketBase
cd ..
nohup ./pocketbase.exe serve --http=127.0.0.1:8390 --dir=pb_data > pb_production.log 2>&1 &
echo $! > .pocketbase.pid
```

---

## KHÔNG THỰC HIỆN

Các thao tác **KHÔNG** được phép:
- ❌ Xóa users hiện có
- ❌ Sửa dữ liệu ngoài scope (chỉ seed data)
- ❌ Chạy migrations
- ❌ Sửa API Rules
- ❌ Sửa hooks
- ❌ Drop tables
- ❌ Truncate collections

---

## SUMMARY

**Files created**: 3 files (seed script, rollback script, README)  
**Collections affected**: stores (1), tables (7), products (5), users (1 update)  
**Idempotency**: ✅ Safe to run multiple times  
**Rollback**: ✅ Clean rollback available  
**Security**: ⚠️ Bypasses API Rules (requires approval)  
**Risk level**: 🟡 MEDIUM (direct DB access)

---

**Status**: ⏸️ **READY FOR REVIEW**  
**Next**: User approval to execute or switch to Option 1 (Manual UI)

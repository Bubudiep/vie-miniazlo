-- H2 BILLIARD — MVP SEED DATA SCRIPT
-- Version: 1.0
-- Date: 2026-10-11
-- WARNING: This script bypasses API Rules by direct database access
-- Only run in development/test environment

-- =============================================================================
-- IDEMPOTENCY CHECK
-- =============================================================================
-- This script checks for existing data before inserting
-- Rollback script: rollback_seed_mvp_data.sql

-- =============================================================================
-- 1. CREATE STORE (if not exists)
-- =============================================================================
INSERT INTO stores (id, name, service_type, created, updated)
SELECT
  'mvp_test_comp01',
  'H2 Billiard - MVP Test',
  'other',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM stores WHERE id = 'mvp_test_comp01'
);

-- Verify store created
SELECT CASE
  WHEN COUNT(*) > 0 THEN '✓ Store created/exists: mvp_test_comp01'
  ELSE '✗ Store creation failed'
END as status
FROM stores WHERE id = 'mvp_test_comp01';

-- =============================================================================
-- 2. UPDATE TEST USER TO HAVE STORE (if exists and not already assigned)
-- =============================================================================
UPDATE users
SET
  store = 'mvp_test_comp01',
  updated = datetime('now')
WHERE username = 'testuser001'
  AND (store IS NULL OR store = '');

-- Verify user updated
SELECT CASE
  WHEN COUNT(*) > 0 THEN '✓ User testuser001 assigned to store'
  ELSE '○ User testuser001 not found or already has store'
END as status
FROM users WHERE username = 'testuser001' AND store = 'mvp_test_comp01';

-- =============================================================================
-- 3. CREATE TABLES (if not exist)
-- =============================================================================
-- Bàn 1: Available
INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00001',
  'mvp_test_comp01',
  'Bàn 1',
  'available',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00001'
);

-- Bàn 2: Occupied
INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00002',
  'mvp_test_comp01',
  'Bàn 2',
  'occupied',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00002'
);

-- Bàn 3: Reserved
INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00003',
  'mvp_test_comp01',
  'Bàn 3',
  'reserved',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00003'
);

-- Bàn 4-7: Available
INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00004',
  'mvp_test_comp01',
  'Bàn 4',
  'available',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00004'
);

INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00005',
  'mvp_test_comp01',
  'Bàn 5',
  'available',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00005'
);

INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00006',
  'mvp_test_comp01',
  'Bàn 6',
  'available',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00006'
);

INSERT INTO tables (id, store, name, status, table_type, created, updated)
SELECT
  'mvp_table_00007',
  'mvp_test_comp01',
  'Bàn 7',
  'available',
  'billiards',
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM tables WHERE id = 'mvp_table_00007'
);

-- Verify tables created
SELECT
  '✓ Tables created: ' || COUNT(*) || '/7' as status
FROM tables WHERE store = 'mvp_test_comp01';

-- =============================================================================
-- 4. CREATE PRODUCTS (if not exist)
-- =============================================================================
-- Product 1: Coca-Cola
INSERT INTO products (id, store, name, price, kind, is_active, created, updated)
SELECT
  'mvp_prod_000001',
  'mvp_test_comp01',
  'Coca-Cola',
  15000,
  'drink',
  TRUE,
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE id = 'mvp_prod_000001'
);

-- Product 2: Sting
INSERT INTO products (id, store, name, price, kind, is_active, created, updated)
SELECT
  'mvp_prod_000002',
  'mvp_test_comp01',
  'Sting dâu',
  15000,
  'drink',
  TRUE,
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE id = 'mvp_prod_000002'
);

-- Product 3: Nước suối
INSERT INTO products (id, store, name, price, kind, is_active, created, updated)
SELECT
  'mvp_prod_000003',
  'mvp_test_comp01',
  'Nước suối',
  8000,
  'drink',
  TRUE,
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE id = 'mvp_prod_000003'
);

-- Product 4: Trà tắc
INSERT INTO products (id, store, name, price, kind, is_active, created, updated)
SELECT
  'mvp_prod_000004',
  'mvp_test_comp01',
  'Trà tắc',
  20000,
  'drink',
  TRUE,
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE id = 'mvp_prod_000004'
);

-- Product 5: Bim bim
INSERT INTO products (id, store, name, price, kind, is_active, created, updated)
SELECT
  'mvp_prod_000005',
  'mvp_test_comp01',
  'Bim bim',
  10000,
  'food',
  TRUE,
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE id = 'mvp_prod_000005'
);

-- Verify products created
SELECT
  '✓ Products created: ' || COUNT(*) || '/5' as status
FROM products WHERE store = 'mvp_test_comp01';

-- =============================================================================
-- FINAL VERIFICATION
-- =============================================================================
SELECT '==================== SEED DATA SUMMARY ====================' as '';

SELECT
  'Stores: ' || COUNT(*) as count
FROM stores WHERE id = 'mvp_test_comp01';

SELECT
  'Tables: ' || COUNT(*) as count
FROM tables WHERE store = 'mvp_test_comp01';

SELECT
  'Products: ' || COUNT(*) as count
FROM products WHERE store = 'mvp_test_comp01';

SELECT
  'User assigned: ' ||
  CASE WHEN store = 'mvp_test_comp01' THEN 'YES' ELSE 'NO' END as status
FROM users WHERE username = 'testuser001';

SELECT '============================================================' as '';

-- Expected output:
-- Stores: 1
-- Tables: 7
-- Products: 5
-- User assigned: YES

-- H2 BILLIARD — ROLLBACK MVP SEED DATA
-- Version: 1.0
-- Date: 2026-10-11
-- WARNING: This script removes ONLY the seed data created by seed_mvp_data.sql
-- It will NOT touch any other data

-- =============================================================================
-- SAFETY CHECK
-- =============================================================================
-- Before running, verify you want to delete these specific records:
SELECT '==================== RECORDS TO BE DELETED ====================' as '';

SELECT 'Store: ' || name as item FROM stores WHERE id = 'mvp_test_comp01';
SELECT 'Tables: ' || COUNT(*) as count FROM tables WHERE store = 'mvp_test_comp01';
SELECT 'Products: ' || COUNT(*) as count FROM products WHERE store = 'mvp_test_comp01';

SELECT '============================================================' as '';
SELECT 'Press Ctrl+C to CANCEL or continue to DELETE' as warning;
SELECT '============================================================' as '';

-- =============================================================================
-- ROLLBACK STEPS
-- =============================================================================

-- 1. Remove user store assignment
UPDATE users
SET
  store = '',
  updated = datetime('now')
WHERE username = 'testuser001'
  AND store = 'mvp_test_comp01';

SELECT '✓ User store assignment cleared' as status;

-- 2. Delete products (must delete before store due to cascade)
DELETE FROM products
WHERE store = 'mvp_test_comp01'
  AND id IN (
    'mvp_prod_000001',
    'mvp_prod_000002',
    'mvp_prod_000003',
    'mvp_prod_000004',
    'mvp_prod_000005'
  );

SELECT '✓ Products deleted: ' || changes() as status;

-- 3. Delete tables
DELETE FROM tables
WHERE store = 'mvp_test_comp01'
  AND id IN (
    'mvp_table_00001',
    'mvp_table_00002',
    'mvp_table_00003',
    'mvp_table_00004',
    'mvp_table_00005',
    'mvp_table_00006',
    'mvp_table_00007'
  );

SELECT '✓ Tables deleted: ' || changes() as status;

-- 4. Delete store
DELETE FROM stores WHERE id = 'mvp_test_comp01';

SELECT '✓ Store deleted: ' || changes() as status;

-- =============================================================================
-- FINAL VERIFICATION
-- =============================================================================
SELECT '==================== ROLLBACK VERIFICATION ====================' as '';

SELECT
  'Stores remaining: ' || COUNT(*) as count
FROM stores WHERE id = 'mvp_test_comp01';
-- Expected: 0

SELECT
  'Tables remaining: ' || COUNT(*) as count
FROM tables WHERE store = 'mvp_test_comp01';
-- Expected: 0

SELECT
  'Products remaining: ' || COUNT(*) as count
FROM products WHERE store = 'mvp_test_comp01';
-- Expected: 0

SELECT
  'User store cleared: ' ||
  CASE WHEN store = '' OR store IS NULL THEN 'YES' ELSE 'NO' END as status
FROM users WHERE username = 'testuser001';
-- Expected: YES

SELECT '============================================================' as '';
SELECT '✓ Rollback complete - all seed data removed' as result;

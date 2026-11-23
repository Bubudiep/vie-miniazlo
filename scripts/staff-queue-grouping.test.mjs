import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupOrderRequests, groupQueueItems, groupQueueItemsByProduct } from '../src/utils/staff-queue.ts';

test('groups one table order by bill and displayed minute', () => {
  const item = { billId: 'bill1', queuedAt: '2026-11-16T10:15:01.000Z' };
  const groups = groupOrderRequests([
    { ...item, id: 'item1' },
    { ...item, id: 'item2', queuedAt: '2026-11-16T10:15:59.999Z' },
    { ...item, id: 'item3', queuedAt: '2026-11-16T10:16:00.000Z' },
    { ...item, id: 'item4', billId: 'bill2' },
  ]);
  assert.deepEqual(groups.map((group) => group.items.map((line) => line.id)), [['item1', 'item2'], ['item3'], ['item4']]);
});

test('groups cooking items by table within one minute of the first item', () => {
  const base = { billId: 'bill1', tableName: 'Bàn 1', queuedAt: '2026-11-16T10:15:01.000Z' };
  const groups = groupQueueItems([
    { ...base, id: 'item1', name: 'Cà phê', quantity: 1 },
    { ...base, id: 'item2', name: 'Nước lọc', quantity: 2, queuedAt: '2026-11-16T10:16:00.000Z' },
    { ...base, id: 'item3', name: 'Trà', quantity: 1, queuedAt: '2026-11-16T10:16:02.000Z' },
    { ...base, id: 'item4', name: 'Bia', quantity: 1, tableName: 'Bàn 2', queuedAt: '2026-11-16T10:15:20.000Z' },
  ]);
  assert.deepEqual(groups.map((group) => group.items.map((line) => line.id)), [['item1', 'item2'], ['item4'], ['item3']]);
});

test('groups cooking items by product and keeps table quantities', () => {
  const base = { billId: 'bill1', queuedAt: '2026-11-16T10:15:01.000Z', unitLabel: 'ly' };
  const groups = groupQueueItemsByProduct([
    { ...base, id: 'item1', name: 'Trà chanh', tableName: 'Bàn 4', quantity: 1 },
    { ...base, id: 'item2', name: 'Trà chanh', tableName: 'Bàn 4', quantity: 2 },
    { ...base, id: 'item2b', name: 'Trà chanh', tableName: 'Bàn 6', quantity: 2 },
    { ...base, id: 'item3', name: 'Cà phê', tableName: 'Bàn 12', quantity: 1 },
  ]);
  assert.deepEqual(groups.map((group) => [group.items[0].name, group.items.reduce((sum, item) => sum + item.quantity, 0), group.items.map((item) => item.tableName)]), [
    ['Cà phê', 1, ['Bàn 12']],
    ['Trà chanh', 5, ['Bàn 4', 'Bàn 6']],
  ]);
  assert.deepEqual(groups.find((group) => group.items[0].name === 'Trà chanh')?.items.map((item) => [item.tableName, item.quantity]), [['Bàn 4', 3], ['Bàn 6', 2]]);
});

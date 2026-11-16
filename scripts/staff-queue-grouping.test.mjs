import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupOrderRequests } from '../src/utils/staff-queue.ts';

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

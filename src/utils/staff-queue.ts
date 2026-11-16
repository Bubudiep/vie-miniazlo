import type { StaffQueueItem } from "@/api/pocketbase";

export type StaffQueueGroup = { id: string; items: StaffQueueItem[] };

export function groupOrderRequests(items: StaffQueueItem[]): StaffQueueGroup[] {
  const groups = new Map<string, StaffQueueItem[]>();
  for (const item of items) {
    const queuedAt = Date.parse(item.queuedAt);
    // shortcut: groups within the displayed minute; persist an order id if simultaneous orders need exact separation.
    const id = Number.isFinite(queuedAt) ? `${item.billId}:${Math.floor(queuedAt / 60000)}` : `${item.billId}:${item.id}`;
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }
  return Array.from(groups, ([id, groupedItems]) => ({ id, items: groupedItems }));
}

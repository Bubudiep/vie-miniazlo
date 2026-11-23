import type { StaffQueueItem } from "@/api/pocketbase";

export type StaffQueueGroup = { id: string; items: StaffQueueItem[] };

const ORDER_GROUP_WINDOW_MS = 60_000;

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

export function groupQueueItems(items: StaffQueueItem[]): StaffQueueGroup[] {
  const groupsByTable = new Map<string, StaffQueueGroup[]>();
  const ordered = items
    .map((item, index) => ({ item, index, time: Date.parse(item.queuedAt) }))
    .sort((a, b) => (Number.isFinite(a.time) && Number.isFinite(b.time) ? a.time - b.time : a.index - b.index));

  for (const { item, time } of ordered) {
    const tableGroups = groupsByTable.get(item.tableName) || [];
    const lastGroup = tableGroups[tableGroups.length - 1];
    const firstTime = lastGroup ? Date.parse(lastGroup.items[0].queuedAt) : NaN;
    if (lastGroup && Number.isFinite(time) && Number.isFinite(firstTime) && time - firstTime <= ORDER_GROUP_WINDOW_MS) {
      lastGroup.items.push(item);
    } else {
      tableGroups.push({ id: `${item.tableName}:${item.id}`, items: [item] });
    }
    groupsByTable.set(item.tableName, tableGroups);
  }

  return Array.from(groupsByTable.values()).flat().sort((a, b) => Date.parse(a.items[0].queuedAt) - Date.parse(b.items[0].queuedAt));
}

export function groupQueueItemsByProduct(items: StaffQueueItem[]): StaffQueueGroup[] {
  const groups = new Map<string, StaffQueueItem[]>();
  for (const item of items) {
    const key = `${item.name}\u0000${item.unitLabel}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups, ([id, groupedItems]) => {
    const byTable = new Map<string, StaffQueueItem>();
    for (const item of groupedItems) {
      const current = byTable.get(item.tableName);
      if (current) current.quantity += item.quantity;
      else byTable.set(item.tableName, { ...item });
    }
    return { id, items: Array.from(byTable.values()) };
  })
    .sort((a, b) => a.items[0].name.localeCompare(b.items[0].name, "vi"));
}

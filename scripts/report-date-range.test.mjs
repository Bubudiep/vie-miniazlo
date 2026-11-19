import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hooks = ["inventory_profit.pb.js", "table_billing.pb.js"].map((name) =>
  readFileSync(new URL(`../pocketbase/pb_hooks/${name}`, import.meta.url), "utf8"),
);

for (const source of hooks) {
  assert.match(source, /toISOString\(\)\.replace\("T", " "\)/);
}

const endOfNovember18Utc = "2026-11-18 17:00:00.000Z";
assert.ok("2026-11-18 16:59:59.999Z" < endOfNovember18Utc);
assert.ok("2026-11-18 23:00:00.000Z" > endOfNovember18Utc);

console.log("Bộ lọc báo cáo dùng cùng định dạng ngày giờ với PocketBase.");

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { inventoryService } from "@/api/services";
import type { InventoryItem, InventoryMovement } from "@/api/pocketbase";
import AdminNav from "@/components/admin-nav";
import StoreHeader from "@/components/store-header";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoneyInput, handleMoneyInput } from "@/utils/format";

const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const messageOf = (error: any) => error?.response?.message || error?.response?.data?.error || error?.message || "Không thể hoàn tất thao tác kho";
type MoveKind = "in" | "adjustment";

export default function AdminInventoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const openSnackbarRef = useRef(openSnackbar);
  openSnackbarRef.current = openSnackbar;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [moveKind, setMoveKind] = useState<MoveKind>("in");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await inventoryService.list();
      setItems(result.items);
      setMovements(result.movements);
    } catch (error) { openSnackbarRef.current({ text: messageOf(error), type: "error", position: "top" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/", { replace: true }); return; }
    void load();
  }, [user?.role, navigate, load]);

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("vi");
    return items.filter((item) => !search || `${item.name} ${item.category}`.toLocaleLowerCase("vi").includes(search));
  }, [items, query]);

  const openMove = (item: InventoryItem, kind: MoveKind) => {
    setSelected(item); setMoveKind(kind); setDirection(1); setQuantity(""); setUnitCost(String(item.purchasePrice || "")); setNote("");
  };

  const saveMovement = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(quantity);
    const cost = Number(unitCost || 0);
    if (!selected || !Number.isFinite(amount) || amount <= 0 || amount > 1000000 || Math.round(amount * 1000) / 1000 !== amount || !Number.isSafeInteger(cost) || cost < 0) {
      openSnackbar({ text: "Số lượng tối đa 3 chữ số thập phân; giá nhập là số nguyên không âm", type: "warning" });
      return;
    }
    setSaving(true);
    try {
      await inventoryService.move({ productId: selected.id, movementType: moveKind, quantity: moveKind === "in" ? amount : amount * direction, unitCost: cost, note: note.trim() });
      setSelected(null);
      await load();
      openSnackbar({ text: moveKind === "in" ? "Đã bổ sung tồn kho" : "Đã điều chỉnh tồn kho", type: "success" });
    } catch (error) { openSnackbar({ text: messageOf(error), type: "error" }); }
    finally { setSaving(false); }
  };

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
    <StoreHeader />
    <AdminNav />
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4">
      <header className="flex items-center justify-between gap-3"><div><Text.Title size="small" className="text-slate-900">Kho hàng</Text.Title><Text size="xSmall" className="mt-1 block text-slate-500">Tồn thực tế, số lượng đang giữ và lịch sử</Text></div><button type="button" aria-label="Tải lại" title="Tải lại" onClick={() => void load()} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"><Icon icon="zi-backup-arrow-solid" /></button></header>
      <label className="relative block"><span className="sr-only">Tìm trong kho</span><Icon icon="zi-search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mặt hàng trong kho" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-base" /></label>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : visible.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có mặt hàng trong kho. Hãy thêm mặt hàng ở mục Mặt hàng.</div> : <section className="space-y-2">
        {visible.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><Text size="small" className="font-semibold text-slate-900">{item.name}</Text><Text size="xSmall" className="mt-1 block text-slate-500">{item.category} · {item.unitLabel || "lần"} · Giá nhập {money(item.purchasePrice)}</Text></div><button type="button" aria-label={`Bổ sung tồn ${item.name}`} title="Bổ sung tồn" onClick={() => openMove(item, "in")} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white"><Icon icon="zi-plus" /></button></div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 py-2 text-center"><div><Text size="xSmall" className="text-slate-500">Tồn hiện có</Text><Text className="mt-1 block text-base font-bold text-slate-900">{item.onHand.toLocaleString("vi-VN")}</Text></div><div><Text size="xSmall" className="text-slate-500">Đang giữ</Text><Text className="mt-1 block text-base font-bold text-amber-700">{item.reserved.toLocaleString("vi-VN")}</Text></div><div><Text size="xSmall" className="text-slate-500">Khả dụng</Text><Text className={`mt-1 block text-base font-bold ${item.available > 0 ? "text-emerald-700" : "text-rose-700"}`}>{item.available.toLocaleString("vi-VN")}</Text></div></div>
          <button type="button" onClick={() => openMove(item, "adjustment")} className="mt-2 min-h-9 text-xs font-semibold text-slate-600">Điều chỉnh tồn</button>
        </article>)}
      </section>}

      <section className="space-y-2"><Text.Title size="small" className="text-slate-900">Biến động gần đây</Text.Title>{movements.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Chưa có giao dịch kho.</div> : <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">{movements.map((movement) => <article key={movement.id} className="flex items-center gap-3 px-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${movement.quantityDelta >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}><Icon icon={movement.quantityDelta >= 0 ? "zi-plus" : "zi-minus-circle"} /></span><div className="min-w-0 flex-1"><Text size="small" className="truncate font-semibold text-slate-900">{movement.productName}</Text><Text size="xSmall" className="mt-1 block text-slate-500">{movement.movementType === "sale" ? "Xuất bán" : movement.movementType === "in" ? "Nhập kho" : "Điều chỉnh"} · {dateTime(movement.occurredAt)}{movement.note ? ` · ${movement.note}` : ""}</Text></div><Text size="small" className={`shrink-0 font-bold ${movement.quantityDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta.toLocaleString("vi-VN")}</Text></article>)}</div>}</section>
    </main>

    <Sheet visible={!!selected} onClose={() => !saving && setSelected(null)} autoHeight swipeToClose>
      <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div className="flex items-center justify-between"><div><Text.Title size="small">{moveKind === "in" ? "Bổ sung tồn kho" : "Điều chỉnh tồn kho"}</Text.Title><Text size="xSmall" className="mt-1 text-slate-500">{selected?.name}</Text></div><button type="button" aria-label="Đóng" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
        <form onSubmit={(event) => void saveMovement(event)} className="space-y-3">
          {moveKind === "adjustment" && <fieldset className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1"><legend className="sr-only">Chiều điều chỉnh</legend><button type="button" aria-pressed={direction === 1} onClick={() => setDirection(1)} className={`min-h-10 rounded-md text-sm font-semibold ${direction === 1 ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600"}`}>Tăng tồn</button><button type="button" aria-pressed={direction === -1} onClick={() => setDirection(-1)} className={`min-h-10 rounded-md text-sm font-semibold ${direction === -1 ? "bg-white text-rose-800 shadow-sm" : "text-slate-600"}`}>Giảm tồn</button></fieldset>}
          <label className="block text-sm font-medium text-slate-700">Số lượng<input required type="number" min={0.001} step={0.001} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
          {moveKind === "in" && <label className="block text-sm font-medium text-slate-700">Giá nhập mỗi đơn vị (VNĐ)<input type="text" inputMode="numeric" value={formatMoneyInput(unitCost)} onChange={(event) => handleMoneyInput(event, setUnitCost)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>}
          <label className="block text-sm font-medium text-slate-700">Ghi chú<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></label>
          {moveKind === "adjustment" && direction < 0 && <Text size="xSmall" className="block text-amber-800">Không thể giảm tồn thấp hơn số lượng đang giữ trong hóa đơn.</Text>}
          <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-semibold text-white disabled:opacity-60">{saving && <Spinner />}{moveKind === "in" ? "Lưu nhập kho" : "Lưu điều chỉnh"}</button>
        </form>
      </Box>
    </Sheet>
  </Page>;
}

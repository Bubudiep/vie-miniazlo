import { useEffect, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router-dom";

import { productService } from "@/api/services";
import type { Product } from "@/api/pocketbase";
import { useAuth } from "@/contexts/AuthContext";

type ProductForm = {
  name: string;
  category: string;
  price: string;
  kind: Product["kind"];
  billingUnit: Product["billing_unit"];
  unitLabel: string;
  description: string;
};

const emptyForm: ProductForm = { name: "", category: "", price: "", kind: "goods", billingUnit: "quantity", unitLabel: "", description: "" };
const money = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const unitLabel = (product: Product) => product.billing_unit === "hour" ? "giờ" : product.billing_unit === "weight" ? (product.unit_label || "kg") : (product.unit_label || "lần");
const kindLabel = (kind: Product["kind"]) => ({ goods: "Hàng hóa", food: "Đồ ăn", drink: "Đồ uống", service: "Dịch vụ" })[kind] || "Hàng hóa";

function errorMessage(error: any) {
  return error?.response?.message || error?.message || "Không thể lưu mặt hàng";
}

export default function AdminProductsPage() {
  const { user, storeId } = useAuth();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!storeId) { setItems([]); setLoading(false); return; }
    try {
      const result = await productService.listAdmin(storeId);
      setItems(result.items);
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.role === "admin") load(); }, [user, storeId]);

  if (user?.role !== "admin") { navigate("/", { replace: true }); return null; }

  const openNew = () => { setEditing(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({ name: product.name, category: product.category || product.kind || "Khác", price: String(product.price), kind: product.kind || "goods", billingUnit: product.billing_unit || "quantity", unitLabel: product.unit_label || "", description: product.description || "" });
    setSheetOpen(true);
  };

  const save = async () => {
    const price = Number(form.price);
    if (!form.name.trim() || !form.category.trim() || !Number.isInteger(price) || price < 0) {
      openSnackbar({ text: "Vui lòng nhập tên, danh mục và giá nguyên hợp lệ", type: "warning" });
      return;
    }
    if (!storeId) return;
    setSaving(true);
    try {
      const data = { store: storeId, name: form.name.trim(), category: form.category.trim(), price, kind: form.kind, billing_unit: form.billingUnit, unit_label: form.unitLabel.trim(), description: form.description.trim(), is_active: editing?.is_active ?? true };
      if (editing) await productService.update(editing.id, data);
      else await productService.create(data);
      setSheetOpen(false);
      await load();
      openSnackbar({ text: editing ? "Đã cập nhật mặt hàng" : "Đã thêm mặt hàng", type: "success" });
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      await productService.update(product.id, { is_active: !product.is_active });
      await load();
      openSnackbar({ text: product.is_active ? "Đã ngừng bán mặt hàng" : "Đã mở bán mặt hàng", type: "success" });
    } catch (error) {
      openSnackbar({ text: errorMessage(error), type: "error" });
    }
  };

  return <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 pb-3 pt-12">
      <button aria-label="Quay lại sơ đồ bàn" title="Quay lại" onClick={() => navigate("/")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon icon="zi-arrow-left" /></button>
      <Text.Title size="small" className="min-w-0 flex-1">Mặt hàng</Text.Title>
      <button aria-label="Thêm mặt hàng" title="Thêm mặt hàng" onClick={openNew} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white"><Icon icon="zi-plus" /></button>
    </header>
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
      <div className="flex items-center justify-between"><Text size="small" className="font-semibold text-slate-700">Danh mục bán tại cửa hàng</Text><Text size="xSmall" className="text-slate-500">{items.filter((item) => item.is_active).length} đang bán</Text></div>
      {loading ? <div className="flex justify-center py-10"><Spinner /></div> : items.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><Text className="text-slate-500">Chưa có mặt hàng</Text><button onClick={openNew} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Thêm mặt hàng</button></div> : <div className="space-y-2">{items.map((product) => <article key={product.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Text size="small" className="font-semibold text-slate-900">{product.name}</Text><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${product.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{product.is_active ? "Đang bán" : "Đã ẩn"}</span></div><Text size="xSmall" className="mt-1 block text-slate-500">{product.category || "Khác"} · {kindLabel(product.kind)} · {unitLabel(product)}</Text><Text size="small" className="mt-2 block font-semibold text-rose-700">{money(product.price)}{product.billing_unit === "hour" ? "/giờ" : product.unit_label ? `/${product.unit_label}` : ""}</Text>{product.description && <Text size="xSmall" className="mt-1 block text-slate-500">{product.description}</Text>}</div><button aria-label={`Sửa ${product.name}`} title="Sửa mặt hàng" onClick={() => openEdit(product)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700"><Icon icon="zi-edit" /></button></div><button onClick={() => toggleActive(product)} className={`mt-3 text-xs font-semibold ${product.is_active ? "text-rose-700" : "text-emerald-700"}`}>{product.is_active ? "Ngừng bán" : "Mở bán"}</button></article>)}</div>}
    </main>

    <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} autoHeight swipeToClose>
      <Box className="max-h-[85vh] space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
        <div className="flex items-center justify-between"><Text.Title size="small">{editing ? "Sửa mặt hàng" : "Thêm mặt hàng"}</Text.Title><button aria-label="Đóng" onClick={() => setSheetOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
        <label className="block text-sm font-medium text-slate-700">Tên mặt hàng<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={255} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium text-slate-700">Danh mục<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Ví dụ: Đồ uống" maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" /></label><label className="block text-sm font-medium text-slate-700">Nhóm<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Product["kind"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"><option value="goods">Hàng hóa</option><option value="food">Đồ ăn</option><option value="drink">Đồ uống</option><option value="service">Dịch vụ</option></select></label></div>
        <label className="block text-sm font-medium text-slate-700">Giá (VNĐ)<input type="number" min={0} step={1} inputMode="numeric" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium text-slate-700">Đơn vị tính<select value={form.billingUnit} onChange={(event) => setForm({ ...form, billingUnit: event.target.value as Product["billing_unit"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"><option value="hour">Theo giờ</option><option value="quantity">Theo số lượng</option><option value="weight">Theo trọng lượng</option></select></label>{form.billingUnit !== "hour" ? <label className="block text-sm font-medium text-slate-700">Tên đơn vị<input value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} placeholder={form.billingUnit === "weight" ? "kg" : "chai, phần..."} maxLength={30} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" /></label> : <div className="flex items-end pb-3 text-sm text-slate-500">Tính từ lúc thêm vào hóa đơn</div>}</div>
        <label className="block text-sm font-medium text-slate-700">Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" /></label>
        <button disabled={saving} onClick={save} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Spinner />}{editing ? "Lưu thay đổi" : "Thêm mặt hàng"}</button>
      </Box>
    </Sheet>
  </Page>;
}

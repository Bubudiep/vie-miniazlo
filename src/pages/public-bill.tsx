import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Icon, Page, Spinner, Text } from "zmp-ui";

import { tableBillingService } from "@/api/services";
import type { TableBill } from "@/api/pocketbase";
import { formatVietnamDateTime } from "@/utils/format";

const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;

export default function PublicBillPage() {
  const { billId = "" } = useParams<{ billId: string }>();
  const [bill, setBill] = useState<TableBill | null>(null);
  const [storeName, setStoreName] = useState("H2 Billiards");
  const [error, setError] = useState("");

  useEffect(() => {
    tableBillingService.getPublicDetail(billId).then((result) => {
      setBill(result.bill);
      setStoreName(result.storeName || "H2 Billiards");
    }).catch((reason) => {
      setError(reason?.response?.data?.error || "Không tìm thấy hóa đơn hoặc đường dẫn đã hết hiệu lực.");
    });
  }, [billId]);

  if (!bill && !error) return <Page className="min-h-screen bg-slate-50"><div className="flex justify-center py-20"><Spinner /></div></Page>;
  if (error) return <Page className="min-h-screen bg-slate-50 px-4 py-16"><div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-white p-5 text-center text-rose-800">{error}</div></Page>;
  if (!bill) return null;

  const status = bill.status === "paid" ? "Đã thanh toán" : bill.status === "cancelled" ? "Đã hủy" : bill.status === "stopped" ? "Đã chốt" : "Đang sử dụng";
  return <Page className="min-h-screen bg-slate-50 px-4 py-6">
    <main className="mx-auto max-w-md space-y-4 pb-6">
      <header className="rounded-xl bg-emerald-700 px-4 py-5 text-center text-white shadow-sm">
        <Text.Title size="small" className="text-white">{storeName}</Text.Title>
        <Text size="small" className="mt-1 block text-emerald-100">Hóa đơn của bạn</Text>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><Text size="small" className="text-slate-500">Mã bill</Text><Text className="break-all font-semibold text-slate-900">{bill.id}</Text></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm"><div><span className="block text-slate-500">Bàn</span><strong>{bill.tableName}</strong></div><div><span className="block text-slate-500">Thời gian</span><strong>{formatVietnamDateTime(bill.paidAt || bill.startedAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong></div></div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Text.Title size="small">Chi tiết</Text.Title><div className="mt-3 divide-y divide-slate-100">{bill.items.filter((item) => item.lineTotal > 0).map((item) => <div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><div className="min-w-0"><strong className="block break-words text-slate-900">{item.name}</strong><span className="text-slate-500">{item.quantity} {item.unitLabel || "lần"} × {money(item.unitPrice)}</span></div><strong className="shrink-0 text-right">{money(item.lineTotal)}</strong></div>)}</div><div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-sm"><div className="flex justify-between"><span>Tạm tính</span><strong>{money(bill.grossAmount)}</strong></div><div className="flex justify-between"><span>Khuyến mại</span><strong>-{money(bill.discountAmount)}</strong></div><div className="flex justify-between text-base font-bold text-emerald-800"><span>Tổng thanh toán</span><strong>{money(bill.totalAmount)}</strong></div></div></section>
      <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><Icon icon="zi-lock" /> Chỉ người có đường link này mới xem được bill</div>
    </main>
  </Page>;
}

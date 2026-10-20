import { useEffect, useMemo, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router-dom";

import { tableService, tableBillingService } from "@/api/services";
import type { Table, TableBillCustomer, TableMap } from "@/api/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import StoreHeader from "@/components/store-header";
import { formatElapsedClock } from "@/utils/format";

const STATUS: Record<Table["status"], { label: string; card: string; dot: string }> = {
  available: { label: "Trống", card: "border-emerald-500 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500" },
  occupied: { label: "Đang chơi", card: "border-rose-500 bg-rose-50 text-rose-900", dot: "bg-rose-500" },
  reserved: { label: "Đã đặt", card: "border-amber-500 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
};

function messageOf(error: any, fallback: string) {
  return error?.response?.message || error?.message || fallback;
}

export default function TablesPage() {
  const { storeId, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [tableMap, setTableMap] = useState<TableMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rowCount, setRowCount] = useState(2);
  const [rowCounts, setRowCounts] = useState<number[]>([3, 3]);
  const [savingLayout, setSavingLayout] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableSheetOpen, setTableSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customers, setCustomers] = useState<TableBillCustomer[]>([]);
  const [busy, setBusy] = useState(false);
  const [, setClockTick] = useState(0);

  const loadTables = async () => {
    if (!storeId) {
      setError("Tài khoản chưa được gắn với cửa hàng nào");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const result = await tableService.getMap();
      setTableMap(result);
    } catch (loadError) {
      setError(messageOf(loadError, "Không thể tải sơ đồ bàn"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTables(); }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") tableService.getMap().then(setTableMap).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [storeId]);

  useEffect(() => {
    if (!settingsOpen || !tableMap) return;
    const rows = Math.max(1, tableMap.layout.rowCount || 1);
    setRowCount(rows);
    setRowCounts(Array.from({ length: rows }, (_, index) => {
      const configured = tableMap.layout.tablesPerRow[index];
      if (Number.isInteger(configured)) return configured;
      return tableMap.tables.filter((table) => table.row_number === index + 1).length;
    }));
  }, [settingsOpen, tableMap]);

  useEffect(() => {
    if (!tableSheetOpen || !isAdmin) return;
    tableBillingService.getCustomers().then((result) => setCustomers(result.items)).catch(() => setCustomers([]));
  }, [tableSheetOpen, isAdmin]);

  const tableRows = useMemo(() => {
    if (!tableMap) return [] as { row: number; tables: Table[] }[];
    const lastRow = Math.max(tableMap.layout.rowCount, ...tableMap.tables.map((table) => table.row_number || 1), 0);
    return Array.from({ length: lastRow }, (_, index) => ({
      row: index + 1,
      tables: tableMap.tables
        .filter((table) => Number(table.row_number) === index + 1)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "vi")),
    }));
  }, [tableMap]);

  const tableNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    tableRows.forEach(({ tables }) => tables.forEach((table) => numbers.set(table.id, numbers.size + 1)));
    return numbers;
  }, [tableRows]);
  const tableLabel = (table: Table | undefined | null) => {
    const number = table ? tableNumbers.get(table.id) : undefined;
    return number ? `Bàn ${number}` : table?.name || "Bàn";
  };
  const hasPlayingTables = tableMap?.tables.some((table) => !!table.playingSince) || false;

  useEffect(() => {
    if (!hasPlayingTables) return;
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [hasPlayingTables]);

  const openBillFor = (tableId: string) => tableMap?.activeBills.find((bill) => bill.table === tableId);

  const openTable = (table: Table) => {
    const bill = openBillFor(table.id);
    if (!isAdmin) {
      if (bill) navigate(`/bills/${bill.id}`);
      return;
    }
    setSelectedTable(table);
    setSelectedCustomer("");
    setTableSheetOpen(true);
  };

  const changeLayout = async () => {
    setSavingLayout(true);
    try {
      await tableService.configureLayout({ rowCount, tablesPerRow: rowCounts.slice(0, rowCount) });
      setSettingsOpen(false);
      await loadTables();
      openSnackbar({ text: "Đã cập nhật sơ đồ bàn", type: "success" });
    } catch (saveError) {
      openSnackbar({ text: messageOf(saveError, "Không thể cập nhật sơ đồ bàn"), type: "error" });
    } finally {
      setSavingLayout(false);
    }
  };

  const startTable = async () => {
    if (!selectedTable) return;
    setBusy(true);
    try {
      const result = await tableService.start(selectedTable.id, selectedCustomer);
      setTableSheetOpen(false);
      navigate(`/bills/${result.billId}`);
    } catch (startError) {
      openSnackbar({ text: messageOf(startError, "Không thể bắt đầu sử dụng bàn"), type: "error" });
      await loadTables();
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: Table["status"]) => {
    if (!selectedTable) return;
    setBusy(true);
    try {
      await tableService.updateStatus(selectedTable.id, status);
      setTableSheetOpen(false);
      await loadTables();
      openSnackbar({ text: "Đã cập nhật trạng thái bàn", type: "success" });
    } catch (statusError) {
      openSnackbar({ text: messageOf(statusError, "Không thể cập nhật bàn"), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const deleteTable = async () => {
    if (!selectedTable || !deletePassword) return;
    setBusy(true);
    try {
      await tableService.delete(selectedTable.id, deletePassword);
      setDeleteSheetOpen(false);
      setTableSheetOpen(false);
      setDeletePassword("");
      setSelectedTable(null);
      await loadTables();
      openSnackbar({ text: "Đã xóa bàn", type: "success" });
    } catch (deleteError) {
      openSnackbar({ text: messageOf(deleteError, "Không thể xóa bàn"), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const setRowCountValue = (value: number) => {
    const nextCount = Math.max(1, Math.min(20, value || 1));
    setRowCount(nextCount);
    setRowCounts((current) => Array.from({ length: nextCount }, (_, index) => current[index] ?? 0));
  };

  if (loading) return <Page className="min-h-screen bg-slate-50"><StoreHeader onSettings={() => setSettingsOpen(true)} /><div className="flex justify-center py-12"><Spinner /></div></Page>;

  if (error) return <Page className="min-h-screen bg-slate-50"><StoreHeader onSettings={() => setSettingsOpen(true)} /><main className="px-4 py-6"><div className="rounded-lg border border-rose-200 bg-rose-50 p-4"><Text className="text-rose-800">{error}</Text><button onClick={() => { setLoading(true); loadTables(); }} className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Thử lại</button></div></main></Page>;

  const existingCounts = Array.from({ length: rowCount }, (_, index) => tableMap?.tables.filter((table) => table.row_number === index + 1).length || 0);
  const keepsExtraTables = existingCounts.some((count, index) => count > (rowCounts[index] || 0)) || (tableMap?.tables.some((table) => table.row_number > rowCount) ?? false);

  return (
    <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
      <StoreHeader onSettings={() => setSettingsOpen(true)} />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Text.Title size="small" className="text-slate-900">Sơ đồ bàn</Text.Title>
            <Text size="xSmall" className="mt-1 text-slate-500">{tableMap?.tables.length || 0} bàn</Text>
          </div>
          {isAdmin && <button onClick={() => navigate("/admin/products")} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><Icon icon="zi-list-1" />Mặt hàng</button>}
        </div>

        {tableRows.length === 0 || tableMap?.tables.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center"><Text className="text-slate-600">Chưa có bàn trong sơ đồ</Text>{isAdmin && <button onClick={() => setSettingsOpen(true)} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Thiết lập bàn</button>}</div>
        ) : tableRows.map(({ row, tables }) => (
          <section key={row} className="border-b border-slate-200 pb-4">
            <div className="mb-2 flex items-center justify-between"><Text size="small" className="font-semibold text-slate-700">Hàng {row}</Text><Text size="xSmall" className="text-slate-500">{tables.length} bàn</Text></div>
            {tables.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">Chưa có bàn</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{tables.map((table) => {
              const bill = openBillFor(table.id);
              const config = STATUS[table.status] || STATUS.reserved;
              return <button key={table.id} type="button" onClick={() => openTable(table)} className={`relative flex min-h-[118px] flex-col items-stretch justify-between rounded-lg border-2 p-3 text-left shadow-sm transition active:scale-[0.99] ${config.card} ${!isAdmin && !bill ? "cursor-default" : ""}`}>
                <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{tableLabel(table)}</span><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`} /></div>
                <div><span className="text-xs font-medium">{config.label}</span>{table.status === "occupied" && table.playingSince && <span className="mt-1 block text-xs font-semibold tabular-nums">{formatElapsedClock(table.playingSince)}</span>}</div>
              </button>;
            })}</div>}
          </section>
        ))}

        {!isAdmin && tableMap?.activeBills.length ? <section className="space-y-2 border-t border-slate-200 pt-4"><Text size="small" className="font-semibold text-slate-800">Hóa đơn của tôi</Text>{tableMap.activeBills.map((bill) => <button key={bill.id} onClick={() => navigate(`/bills/${bill.id}`)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left"><span className="text-sm font-medium text-slate-800">{tableLabel(tableMap.tables.find((table) => table.id === bill.table))}</span><span className="text-sm font-semibold text-emerald-700">Xem hóa đơn</span></button>)}</section> : null}
      </main>

      <Sheet visible={settingsOpen && isAdmin} onClose={() => setSettingsOpen(false)} autoHeight swipeToClose>
        <Box className="max-h-[85vh] space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          <div className="flex items-center justify-between"><Text.Title size="small">Thiết lập sơ đồ bàn</Text.Title><button aria-label="Đóng" onClick={() => setSettingsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
          <label className="block text-sm font-medium text-slate-700">Số hàng<input type="number" min={1} max={20} value={rowCount} onChange={(event) => setRowCountValue(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" /></label>
          <div className="space-y-2"><Text size="small" className="font-semibold text-slate-700">Số bàn từng hàng</Text>{rowCounts.slice(0, rowCount).map((count, index) => <label key={index} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><span>Hàng {index + 1}</span><input type="number" min={0} max={100} value={count} onChange={(event) => setRowCounts((current) => current.map((value, row) => row === index ? Math.max(0, Math.min(100, Number(event.target.value) || 0)) : value))} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-right text-base" /></label>)}</div>
          {keepsExtraTables && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Các bàn vượt số lượng mới sẽ được giữ nguyên. Hãy chọn và xóa từng bàn nếu không còn sử dụng.</div>}
          <button disabled={savingLayout} onClick={changeLayout} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{savingLayout && <Spinner />}Lưu sơ đồ</button>
          <button onClick={() => { setSettingsOpen(false); navigate("/admin/products"); }} className="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700">Quản lý mặt hàng</button>
        </Box>
      </Sheet>

      <Sheet visible={tableSheetOpen && isAdmin} onClose={() => setTableSheetOpen(false)} autoHeight swipeToClose>
        <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          <div className="flex items-center justify-between"><div><Text.Title size="small">{tableLabel(selectedTable)}</Text.Title><Text size="xSmall" className="text-slate-500">{selectedTable ? STATUS[selectedTable.status]?.label : ""}</Text></div><button aria-label="Đóng" onClick={() => setTableSheetOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
          {selectedTable && openBillFor(selectedTable.id) ? <><div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Bàn này đang có hóa đơn{openBillFor(selectedTable.id)?.status === "wallet_pending" ? " chờ duyệt ví" : ""}.</div><button onClick={() => { const bill = openBillFor(selectedTable.id); if (bill) navigate(`/bills/${bill.id}`); setTableSheetOpen(false); }} className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white">Mở hóa đơn</button></> : selectedTable?.status === "available" ? <>
            <label className="block text-sm font-medium text-slate-700">Gắn tài khoản khách (không bắt buộc)<select value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"><option value="">Không gắn tài khoản</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.fullname || customer.username} (@{customer.username})</option>)}</select></label>
            <button disabled={busy} onClick={startTable} className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">Bắt đầu sử dụng</button>
            <button disabled={busy} onClick={() => changeStatus("reserved")} className="min-h-11 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-800 disabled:opacity-60">Đặt bàn</button>
          </> : selectedTable?.status === "reserved" ? <button disabled={busy} onClick={() => changeStatus("available")} className="min-h-11 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 disabled:opacity-60">Hủy đặt bàn</button> : null}
          {selectedTable?.status === "available" && !openBillFor(selectedTable.id) && <button onClick={() => { setTableSheetOpen(false); setDeleteSheetOpen(true); setDeletePassword(""); }} className="w-full rounded-lg border border-rose-300 py-3 text-sm font-semibold text-rose-700">Xóa bàn</button>}
        </Box>
      </Sheet>

      <Sheet visible={deleteSheetOpen && isAdmin} onClose={() => setDeleteSheetOpen(false)} autoHeight>
        <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          <Text.Title size="small" className="text-rose-800">Xác nhận xóa {tableLabel(selectedTable)}</Text.Title>
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm leading-5 text-rose-900">Bàn sẽ bị xóa khỏi sơ đồ. Chỉ bàn đang trống và không có hóa đơn mở mới được xóa. Hãy xác nhận đúng bàn trước khi tiếp tục.</div>
          <label className="block text-sm font-medium text-slate-700">Nhập lại mật khẩu admin<input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" /></label>
          <div className="grid grid-cols-2 gap-2"><button onClick={() => setDeleteSheetOpen(false)} className="min-h-11 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700">Hủy</button><button disabled={!deletePassword || busy} onClick={deleteTable} className="min-h-11 rounded-lg bg-rose-700 text-sm font-semibold text-white disabled:opacity-50">Xóa bàn</button></div>
        </Box>
      </Sheet>
    </Page>
  );
}

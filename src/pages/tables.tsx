import { useEffect, useMemo, useState } from "react";
import { Box, Icon, Page, Sheet, Spinner, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "react-router-dom";

import { adminNotificationService, tableService, tableBillingService } from "@/api/services";
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

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
  const [tablesPerRow, setTablesPerRow] = useState(4);
  const [layoutDraft, setLayoutDraft] = useState(4);
  const [totalTablesDraft, setTotalTablesDraft] = useState(0);
  const [savingLayout, setSavingLayout] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableNameDraft, setTableNameDraft] = useState("");
  const [editingTableName, setEditingTableName] = useState(false);
  const [tableSheetOpen, setTableSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customers, setCustomers] = useState<TableBillCustomer[]>([]);
  const [busy, setBusy] = useState(false);
  const [, setClockTick] = useState(0);
  const [seenNotifications, setSeenNotifications] = useState<string[]>([]);

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
    if (!isAdmin) return;
    let active = true;
    const loadNotifications = () => adminNotificationService.list().then((result) => {
      if (!active) return;
      const unseen = result.items.filter((item) => !seenNotifications.includes(item.id));
      if (unseen.length) {
        unseen.forEach((item) => openSnackbar({ text: `${item.title}: ${item.body}`, type: "warning", position: "top" }));
        setSeenNotifications((current) => [...current, ...unseen.map((item) => item.id)]);
      }
    }).catch(() => {});
    loadNotifications();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") loadNotifications(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isAdmin, seenNotifications]);

  const layoutStorageKey = `billiard:table-columns:${storeId || "unknown"}:${user?.id || "guest"}`;

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(layoutStorageKey));
    const value = Number.isInteger(saved) && saved >= 1 && saved <= 12 ? saved : 4;
    setTablesPerRow(value);
    setLayoutDraft(value);
  }, [layoutStorageKey]);

  useEffect(() => {
    if (settingsOpen && tableMap) setTotalTablesDraft(tableMap.tables.length);
  }, [settingsOpen, tableMap]);

  useEffect(() => {
    if (!tableSheetOpen || !isAdmin) return;
    tableBillingService.getCustomers().then((result) => setCustomers(result.items)).catch(() => setCustomers([]));
  }, [tableSheetOpen, isAdmin]);

  const tableRows = useMemo(() => {
    if (!tableMap) return [] as { row: number; tables: Table[] }[];
    const sortedTables = [...tableMap.tables].sort((a, b) =>
      a.row_number - b.row_number || a.position - b.position || a.name.localeCompare(b.name, "vi"),
    );
    return Array.from({ length: Math.ceil(sortedTables.length / tablesPerRow) }, (_, index) => ({
      row: index + 1,
      tables: sortedTables.slice(index * tablesPerRow, (index + 1) * tablesPerRow),
    }));
  }, [tableMap, tablesPerRow]);

  const tableNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    tableRows.forEach(({ tables }) => tables.forEach((table) => numbers.set(table.id, numbers.size + 1)));
    return numbers;
  }, [tableRows]);
  const filteredCustomers = useMemo(() => {
    const query = normalizeSearch(customerQuery.trim());
    if (!query) return customers;
    return customers.filter((customer) => normalizeSearch(`${customer.fullname || ""} ${customer.username || ""}`).includes(query));
  }, [customers, customerQuery]);
  const tableLabel = (table: Table | undefined | null) => {
    const number = table ? tableNumbers.get(table.id) : undefined;
    return table?.name?.trim() || (number ? `Bàn ${number}` : "Bàn");
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
    if (bill && !isAdmin) {
      navigate(`/bills/${bill.id}`);
      return;
    }
    if (!isAdmin) return;
    setSelectedTable(table);
    setTableNameDraft(table.name || "");
    setEditingTableName(false);
    setSelectedCustomer("");
    setCustomerQuery("");
    setCustomerPickerOpen(false);
    setTableSheetOpen(true);
  };

  const saveLayout = async () => {
    const value = Math.max(1, Math.min(12, Number(layoutDraft) || 1));
    const totalTables = Math.max(0, Math.min(500, Number(totalTablesDraft) || 0));
    if (isAdmin && tableMap && totalTables < tableMap.tables.length) {
      openSnackbar({ text: "Không thể tự động xóa bàn đang có dữ liệu. Hãy xóa từng bàn trong danh sách.", type: "warning" });
      return;
    }
    if (isAdmin && tableMap) {
      setSavingLayout(true);
      try {
        const layoutRowCount = Math.max(1, tableMap.layout.rowCount || 1, ...tableMap.tables.map((table) => Number(table.row_number) || 1));
        const counts = Array.from({ length: layoutRowCount }, (_, index) => tableMap.tables.filter((table) => (Number(table.row_number) || 1) === index + 1).length);
        counts[counts.length - 1] += Math.max(0, totalTables - tableMap.tables.length);
        await tableService.configureLayout({ rowCount: layoutRowCount, tablesPerRow: counts });
        await loadTables();
      } catch (saveError) {
        openSnackbar({ text: messageOf(saveError, "Không thể cập nhật tổng số bàn"), type: "error" });
        setSavingLayout(false);
        return;
      }
      setSavingLayout(false);
    }
    setTablesPerRow(value);
    setLayoutDraft(value);
    window.localStorage.setItem(layoutStorageKey, String(value));
    setSettingsOpen(false);
    openSnackbar({ text: isAdmin ? "Đã cập nhật tổng số bàn và cách hiển thị" : "Đã lưu cách ngắt dòng trên thiết bị này", type: "success" });
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

  const renameTable = async () => {
    if (!selectedTable) return;
    const name = tableNameDraft.trim();
    if (!name) {
      openSnackbar({ text: "Tên bàn không được để trống", type: "warning" });
      return;
    }
    setBusy(true);
    try {
      await tableService.rename(selectedTable.id, name);
      setSelectedTable((current) => current ? { ...current, name } : current);
      setEditingTableName(false);
      await loadTables();
      openSnackbar({ text: "Đã đổi tên bàn", type: "success" });
    } catch (renameError) {
      openSnackbar({ text: messageOf(renameError, "Không thể đổi tên bàn"), type: "error" });
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

  if (loading) return <Page className="min-h-screen bg-slate-50"><StoreHeader onSettings={() => setSettingsOpen(true)} /><div className="flex justify-center py-12"><Spinner /></div></Page>;

  if (error) return <Page className="min-h-screen bg-slate-50"><StoreHeader onSettings={() => setSettingsOpen(true)} /><main className="px-4 py-6"><div className="rounded-lg border border-rose-200 bg-rose-50 p-4"><Text className="text-rose-800">{error}</Text><button onClick={() => { setLoading(true); loadTables(); }} className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Thử lại</button></div></main></Page>;

  return (
    <Page className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
      <StoreHeader onSettings={() => setSettingsOpen(true)} />
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Text.Title size="small" className="text-slate-900">Sơ đồ bàn</Text.Title>
            <Text size="xSmall" className="mt-1 text-slate-500">{tableMap?.tables.length || 0} bàn</Text>
          </div>
          <div className="flex gap-2"><button aria-label="Thiết lập hiển thị bàn" title="Thiết lập hiển thị" onClick={() => setSettingsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"><Icon icon="zi-settings" /></button>{isAdmin && <><button aria-label="Mở Dashboard" title="Dashboard" onClick={() => navigate("/admin")} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"><Icon icon="zi-list-1" /></button><button aria-label="Mở lịch sử bill" title="Lịch sử bill" onClick={() => navigate("/admin/bill-history")} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"><Icon icon="zi-clock-1" /></button><button onClick={() => navigate("/admin/products")} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><Icon icon="zi-list-1" />Mặt hàng</button></>}</div>
        </div>

        {tableRows.length === 0 || tableMap?.tables.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center"><Text className="text-slate-600">Chưa có bàn trong sơ đồ</Text><button onClick={() => setSettingsOpen(true)} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Thiết lập hiển thị</button></div>
        ) : <div className="space-y-3">{tableRows.map(({ row, tables }) => <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tablesPerRow}, minmax(0, 1fr))` }}>{tables.map((table) => {
              const bill = openBillFor(table.id);
              const config = STATUS[table.status] || STATUS.reserved;
              return <button key={table.id} type="button" onClick={() => openTable(table)} className={`relative flex min-h-[118px] flex-col items-stretch justify-between rounded-lg border-2 p-3 text-left shadow-sm transition active:scale-[0.99] ${config.card} ${!isAdmin && !bill ? "cursor-default" : ""}`}>
                <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{tableLabel(table)}</span><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`} /></div>
                <div><span className="text-xs font-medium">{config.label}</span>{table.status === "occupied" && table.playingSince && <span className="mt-1 block text-xs font-semibold tabular-nums">{formatElapsedClock(table.playingSince)}</span>}</div>
              </button>;
            })}</div>)}</div>}

        {!isAdmin && tableMap?.activeBills.length ? <section className="space-y-2 border-t border-slate-200 pt-4"><Text size="small" className="font-semibold text-slate-800">Hóa đơn của tôi</Text>{tableMap.activeBills.map((bill) => <button key={bill.id} onClick={() => navigate(`/bills/${bill.id}`)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left"><span className="text-sm font-medium text-slate-800">{tableLabel(tableMap.tables.find((table) => table.id === bill.table))}</span><span className="text-sm font-semibold text-emerald-700">Xem hóa đơn</span></button>)}</section> : null}
      </main>

      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} autoHeight swipeToClose>
        <Box className="max-h-[85vh] space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          <div className="flex items-center justify-between"><Text.Title size="small">Thiết lập hiển thị bàn</Text.Title><button aria-label="Đóng" onClick={() => setSettingsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
          <p className="text-sm leading-5 text-slate-600">Số bàn vẫn đánh số liên tục. Thiết lập này chỉ lưu trên thiết bị và tài khoản của bạn.</p>
          {isAdmin && <label className="block text-sm font-medium text-slate-700">Tổng số bàn<input type="number" min={0} max={500} value={totalTablesDraft} onChange={(event) => setTotalTablesDraft(Math.max(0, Math.min(500, Number(event.target.value) || 0)))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" /></label>}
          <label className="block text-sm font-medium text-slate-700">Số bàn mỗi dòng<input type="number" min={1} max={12} value={layoutDraft} onChange={(event) => setLayoutDraft(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" /></label>
          <button disabled={savingLayout} onClick={() => void saveLayout()} className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{savingLayout ? "Đang lưu..." : isAdmin ? "Lưu thiết lập" : "Lưu hiển thị"}</button>
          {isAdmin && <><button onClick={() => { setSettingsOpen(false); navigate("/admin/products"); }} className="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700">Quản lý mặt hàng</button>
          <button onClick={() => { setSettingsOpen(false); navigate("/admin"); }} className="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700">Dashboard quản trị</button>
          <button onClick={() => { setSettingsOpen(false); navigate("/admin/inventory"); }} className="w-full rounded-lg border border-emerald-200 bg-white py-3 text-sm font-semibold text-emerald-800">Quản lý kho hàng</button>
          <button onClick={() => { setSettingsOpen(false); navigate("/admin/bill-history"); }} className="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700">Lịch sử bill</button>
          <button onClick={() => { setSettingsOpen(false); navigate("/admin/reports"); }} className="w-full rounded-lg border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700">Báo cáo doanh thu</button>
          <button onClick={() => { setSettingsOpen(false); navigate("/admin/promotions"); }} className="w-full rounded-lg border border-emerald-200 bg-white py-3 text-sm font-semibold text-emerald-800">Khuyến mại</button></>}
        </Box>
      </Sheet>

      <Sheet visible={tableSheetOpen && isAdmin} onClose={() => setTableSheetOpen(false)} autoHeight swipeToClose>
        <Box className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">{editingTableName ? <div className="flex items-center gap-2"><input autoFocus value={tableNameDraft} onChange={(event) => setTableNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameTable(); if (event.key === "Escape") { setTableNameDraft(selectedTable?.name || ""); setEditingTableName(false); } }} maxLength={80} aria-label="Tên bàn" className="min-w-0 flex-1 rounded-lg border border-emerald-400 bg-white px-3 py-2 text-base font-semibold text-slate-900" /><button disabled={busy} aria-label="Lưu tên bàn" onClick={() => void renameTable()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white disabled:opacity-60"><Icon icon="zi-check" /></button></div> : <button type="button" onClick={() => setEditingTableName(true)} className="flex max-w-full items-center gap-2 text-left"><Text.Title size="small" className="break-words">{tableLabel(selectedTable)}</Text.Title><Icon icon="zi-edit" className="shrink-0 text-slate-500" /></button>}<Text size="xSmall" className="mt-1 block text-slate-500">{selectedTable ? STATUS[selectedTable.status]?.label : ""}</Text></div><button aria-label="Đóng" onClick={() => setTableSheetOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Icon icon="zi-close" /></button></div>
          {selectedTable && openBillFor(selectedTable.id) ? <><div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Bàn này đang có hóa đơn{openBillFor(selectedTable.id)?.status === "wallet_pending" ? " chờ duyệt ví" : ""}.</div><button onClick={() => { const bill = openBillFor(selectedTable.id); if (bill) navigate(`/bills/${bill.id}`); setTableSheetOpen(false); }} className="min-h-12 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white">Mở hóa đơn</button></> : selectedTable?.status === "available" ? <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Gắn tài khoản khách (không bắt buộc)</label>
              <button type="button" aria-expanded={customerPickerOpen} aria-controls="customer-picker-options" onClick={() => { setCustomerPickerOpen((open) => !open); setCustomerQuery(""); }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 text-left text-base text-slate-800">
                <span className="truncate">{customers.find((customer) => customer.id === selectedCustomer)?.fullname || customers.find((customer) => customer.id === selectedCustomer)?.username || "Không gắn tài khoản"}</span>
                <Icon icon={customerPickerOpen ? "zi-chevron-up" : "zi-chevron-down"} className="shrink-0 text-slate-500" />
              </button>
              {customerPickerOpen && <div id="customer-picker-options" className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <input autoFocus type="search" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Tìm theo tên hoặc username" aria-label="Tìm tài khoản khách" className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base" />
                <div role="listbox" aria-label="Tài khoản khách" className="mt-2 max-h-48 overflow-y-auto">
                  <button type="button" role="option" aria-selected={!selectedCustomer} onClick={() => { setSelectedCustomer(""); setCustomerPickerOpen(false); setCustomerQuery(""); }} className="min-h-11 w-full rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50">Không gắn tài khoản</button>
                  {filteredCustomers.map((customer) => <button type="button" role="option" aria-selected={selectedCustomer === customer.id} key={customer.id} onClick={() => { setSelectedCustomer(customer.id); setCustomerPickerOpen(false); setCustomerQuery(""); }} className="min-h-11 w-full rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50">{customer.fullname || customer.username} (@{customer.username})</button>)}
                  {customerQuery.trim() && filteredCustomers.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Không tìm thấy khách hàng phù hợp.</p>}
                </div>
              </div>}
            </div>
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

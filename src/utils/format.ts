import type { ChangeEvent } from "react";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function formatVietnamDateTime(value: string | number | Date, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }): string {
  return new Date(value).toLocaleString("vi-VN", { ...options, timeZone: VIETNAM_TIME_ZONE });
}

export function formatVietnamDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }): string {
  return new Date(value).toLocaleDateString("vi-VN", { ...options, timeZone: VIETNAM_TIME_ZONE });
}

export function toVietnamDateTimeInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromVietnamDateTimeInput(value: string): string {
  return value ? new Date(`${value}:00+07:00`).toISOString() : "";
}

export function vietnamDateBounds(date: string, end = false): number {
  return Date.parse(`${date}T${end ? "23:59:59.999" : "00:00:00"}+07:00`);
}

export function normalizeMoneyInput(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function formatMoneyInput(value: string): string {
  return normalizeMoneyInput(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function handleMoneyInput(event: ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) {
  const input = event.currentTarget;
  const digitsBeforeCursor = normalizeMoneyInput(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
  const value = normalizeMoneyInput(input.value);
  onChange(value);
  const cursor = formatMoneyInput(value.slice(0, digitsBeforeCursor)).length;
  requestAnimationFrame(() => input.setSelectionRange(cursor, cursor));
}

export function formatCurrency(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

export function formatMinutes(value: string | number): string {
  const total = Math.round(
    typeof value === "string" ? parseFloat(value) : value,
  );
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

export function formatDuration(value: number): string {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts = [
    days ? `${days} ngày` : "",
    hours ? `${hours} giờ` : "",
    minutes ? `${minutes} phút` : "",
  ].filter(Boolean);
  return parts.join(" ") || "0 phút";
}

export function formatDateTime(value: string): string {
  return formatVietnamDateTime(value);
}

export function formatElapsedSince(value: string): string {
  const start = new Date(value).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  return formatMinutes(minutes);
}

export function formatElapsedClock(value: string): string {
  const start = new Date(value).getTime();
  const totalSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

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

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

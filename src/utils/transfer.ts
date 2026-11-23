export function normalizeTransferContent(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, (character) => character === "Đ" ? "D" : "d");
}

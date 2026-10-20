const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function normalizeUsername(value: string): string {
  return value
    .replace(/[đĐ]/g, (letter) => letter === 'đ' ? 'd' : 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

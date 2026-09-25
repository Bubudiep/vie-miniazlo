// Single API module: one axios instance + debounced GET/POST/PATCH/DELETE
// helpers used everywhere in the app (see membership.* views in the VieStore
// Django backend under C:\Dev\Django\VieStore for what each endpoint returns).
import axios, { AxiosError, AxiosRequestConfig } from "axios";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "https://itx.vba.io.vn/";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const TOKEN_STORAGE_KEY = "culibilliards_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage unavailable (e.g. private mode) — token just won't survive a reload.
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `CToken ${token}`;
  }
  return config;
});

export class ApiError extends Error {
  status?: number;
  detail: unknown;

  constructor(message: string, status?: number, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const detail = error.response?.data?.detail || error.response?.data;
    const message = typeof detail === "string" ? detail : error.message;
    return Promise.reject(
      new ApiError(message, error.response?.status, error.response?.data),
    );
  },
);

// ---- Debounce plumbing -----------------------------------------------
// Calls that share a `key` within `wait` ms are collapsed into a single
// underlying request; every caller in that window gets the same result.
// Useful for POST/PATCH/DELETE triggered by fast repeated taps (e.g. a
// "Thanh toán" button) and for GETs fired on every keystroke (e.g. search).

type Waiter<T> = {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const debounceWaiters = new Map<string, Waiter<unknown>[]>();

function debounced<T>(
  key: string,
  wait: number,
  task: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const waiters = (debounceWaiters.get(key) as Waiter<T>[] | undefined) ?? [];
    waiters.push({ resolve, reject });
    debounceWaiters.set(key, waiters as Waiter<unknown>[]);

    const existing = debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    debounceTimers.set(
      key,
      setTimeout(() => {
        debounceTimers.delete(key);
        const pending =
          (debounceWaiters.get(key) as Waiter<T>[] | undefined) ?? [];
        debounceWaiters.delete(key);
        task().then(
          (result) => pending.forEach((w) => w.resolve(result)),
          (err) => pending.forEach((w) => w.reject(err)),
        );
      }, wait),
    );
  });
}

type DebounceOpts = { debounceMs?: number; key?: string };

export function apiGet<T = any>(
  url: string,
  config?: AxiosRequestConfig,
  opts: DebounceOpts = {},
): Promise<T> {
  const { debounceMs = 300, key = `GET ${url}` } = opts;
  return debounced(key, debounceMs, () =>
    api.get<T>(url, config).then((r) => r.data),
  );
}

export function apiPost<T = any>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
  opts: DebounceOpts = {},
): Promise<T> {
  const { debounceMs = 500, key = `POST ${url}` } = opts;
  return debounced(key, debounceMs, () =>
    api.post<T>(url, data, config).then((r) => r.data),
  );
}

export function apiPatch<T = any>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
  opts: DebounceOpts = {},
): Promise<T> {
  const { debounceMs = 500, key = `PATCH ${url}` } = opts;
  return debounced(key, debounceMs, () =>
    api.patch<T>(url, data, config).then((r) => r.data),
  );
}

export function apiDelete<T = any>(
  url: string,
  config?: AxiosRequestConfig,
  opts: DebounceOpts = {},
): Promise<T> {
  const { debounceMs = 500, key = `DELETE ${url}` } = opts;
  return debounced(key, debounceMs, () =>
    api.delete<T>(url, config).then((r) => r.data),
  );
}

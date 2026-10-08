// Member session: who is logged in (a store.Customer on the VieStore backend),
// their membership card and points balance. Guests have no CToken stored.
import axios from "axios";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { getAccessToken, getPhoneNumber, getUserInfo } from "zmp-sdk";

import {
  ApiError,
  apiGet,
  apiPost,
  getStoredToken,
  setStoredToken,
} from "@/api/client";

export interface Customer {
  id: number;
  name: string;
  phone: string;
  order_count: number;
  total_spent: number | string;
}

export interface MembershipCard {
  id: number;
  remaining_minutes: string;
  expires_at: string | null;
  is_expired: boolean;
}

export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "member";
      customer: Customer;
      card: MembershipCard;
      points: number;
    };

const COMPANY_ID = Number(import.meta.env.VITE_COMPANY_ID) || 1;
const ZALO_APP_SECRET = (import.meta.env.VITE_ZALO_APP_SECRET as string) || "";

const store = getDefaultStore();

export const authAtom = atom<AuthState>(
  getStoredToken() ? { status: "loading" } : { status: "guest" },
);

export function useAuth() {
  return useAtomValue(authAtom);
}

async function loadMember() {
  const [me, points] = await Promise.all([
    apiGet<{ customer: Customer; card: MembershipCard }>("membership/me/"),
    apiGet<{ balance: number }>("membership/points/"),
  ]);
  store.set(authAtom, {
    status: "member",
    customer: me.customer,
    card: me.card,
    points: points.balance,
  });
}

// Called once at startup: turn a stored CToken back into a member session.
export async function restoreSession() {
  if (!getStoredToken()) return;
  try {
    await loadMember();
  } catch (error) {
    // Token rotated (login on another device) or revoked — back to guest.
    if (error instanceof ApiError && error.status === 401)
      setStoredToken(null);
    store.set(authAtom, { status: "guest" });
  }
}

async function login(payload: Record<string, unknown>) {
  const { token } = await apiPost<{ token: string }>("membership/auth/login/", {
    company_id: COMPANY_ID,
    ...payload,
  });
  setStoredToken(token);
  await loadMember();
}

// Exchange the getPhoneNumber() token (single-use, expires after 2 minutes) for
// the real phone number — see
// https://docs.zaloplatforms.com/docs/MA/api/user/user-information/getPhoneNumber
async function resolveZaloPhone(accessToken: string, phoneToken: string) {
  if (!ZALO_APP_SECRET) throw new Error("Chưa cấu hình VITE_ZALO_APP_SECRET.");

  const { data } = await axios.get("https://graph.zalo.me/v2.0/me/info", {
    headers: {
      access_token: accessToken,
      code: phoneToken,
      secret_key: ZALO_APP_SECRET,
    },
    timeout: 10000,
  });
  if (data?.error)
    throw new Error(data.message || "Không lấy được số điện thoại từ Zalo.");

  const number: string = data?.data?.number ?? "";
  if (!number) throw new Error("Zalo không trả về số điện thoại.");
  // Zalo returns "849xxxxxxxx" — the backend stores the local "09xxxxxxxx".
  return number.startsWith("84") ? `0${number.slice(2)}` : number;
}

// Zalo login: the phone token is exchanged for the phone number right here on
// the client, then the backend logs that phone in.
export async function loginWithZalo() {
  const name = await getUserInfo({ autoRequestPermission: true })
    .then(({ userInfo }) => userInfo.name)
    .catch(() => "");

  let phoneToken: string | undefined;
  try {
    phoneToken = (await getPhoneNumber()).token;
  } catch {
    throw new Error("Bạn cần cho phép chia sẻ số điện thoại để đăng nhập.");
  }
  if (!phoneToken) throw new Error("Không lấy được số điện thoại từ Zalo.");

  const accessToken = await getAccessToken();
  const phone = await resolveZaloPhone(accessToken, phoneToken);
  await login({ phone, name });
}

// The backend only accepts a raw phone while DEBUG=True and ZALO_APP_SECRET is
// unset on the server (see membership.api.CustomerLoginView).
export async function loginWithPhone(phone: string) {
  await login({ phone });
}

export function logout() {
  setStoredToken(null);
  store.set(authAtom, { status: "guest" });
}

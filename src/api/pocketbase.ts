import PocketBase from 'pocketbase';

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8390'
).replace(/\/+$/, '');

const pb = new PocketBase(apiBaseUrl);

pb.autoCancellation(false);

export default pb;

export interface Store {
  id: string;
  name: string;
  service_type: 'billiard' | 'restaurant' | 'other';
  address?: string;
  phone?: string;
  email?: string;
  created: string;
  updated: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  fullname?: string;
  zalo_id?: string;
  store?: string;
  role?: 'admin' | 'user';
  verified: boolean;
  is_approved?: boolean;
  created: string;
  updated: string;
}

export interface Product {
  id: string;
  store: string;
  name: string;
  description?: string;
  price: number;
  kind: 'goods' | 'food' | 'drink' | 'service';
  category?: string;
  billing_unit: 'hour' | 'quantity' | 'weight';
  unit_label?: string;
  image?: string;
  is_active: boolean;
  created: string;
  updated: string;
}

export interface Table {
  id: string;
  store: string;
  name: string;
  status: 'available' | 'occupied' | 'reserved';
  table_type: 'dining' | 'billiards' | 'karaoke' | 'other';
  row_number: number;
  position: number;
  playingSince?: string;
  created: string;
  updated: string;
}

export interface TableLayout {
  rowCount: number;
  tablesPerRow: number[];
}

export interface TableOpenBillSummary {
  id: string;
  table: string;
  customer: string;
  status: 'open' | 'wallet_pending';
}

export interface TableMap {
  layout: TableLayout;
  tables: Table[];
  activeBills: TableOpenBillSummary[];
}

export interface TableBillItem {
  id: string;
  product: string;
  name: string;
  billingUnit: 'hour' | 'quantity' | 'weight';
  unitLabel: string;
  unitPrice: number;
  quantity: number;
  startedAt: string;
  lineTotal: number;
}

export interface TableBill {
  id: string;
  table: string;
  tableName: string;
  customer: string;
  status: 'open' | 'wallet_pending' | 'paid' | 'cancelled';
  paymentMethod: '' | 'cash' | 'transfer' | 'wallet';
  totalAmount: number;
  requestedAmount: number;
  paymentError: string;
  startedAt: string;
  paidAt: string;
  items: TableBillItem[];
}

export interface TableBillProduct extends Pick<Product, 'id' | 'store' | 'name' | 'description' | 'kind' | 'price'> {
  category: string;
  billingUnit: 'hour' | 'quantity' | 'weight';
  unitLabel: string;
}

export interface TableBillCustomer {
  id: string;
  username: string;
  fullname: string;
}

export interface Customer {
  id: string;
  store: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created: string;
  updated: string;
}

export interface WalletPromoLot {
  id: string;
  originalAmount: number;
  remainingAmount: number;
  expiresAt: string;
  status: 'active' | 'expired' | 'consumed';
}

export interface WalletSummary {
  id: string;
  user: string;
  store: string;
  mainBalance: number;
  promoBalance: number;
  promoLots: WalletPromoLot[];
}

export interface WalletTransaction {
  id: string;
  wallet: string;
  user: string;
  store: string;
  wallet_type: 'main' | 'promo';
  direction: 'credit' | 'debit';
  amount: number;
  reason: string;
  actor?: string;
  promo_lot?: string;
  reference_type?: string;
  reference_id?: string;
  balance_before: number;
  balance_after: number;
  created: string;
}

export interface WalletTransactionPage {
  page: number;
  perPage: number;
  totalItems: number;
  items: WalletTransaction[];
}

export interface WalletUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface WalletOrder {
  id: string;
  user: string;
  store: string;
  table?: string;
  totalAmount: number;
  status: 'unpaid' | 'paid' | 'cancelled';
  paymentMethod?: string;
  paidAt?: string;
}

export interface XuSummary {
  id: string;
  user: string;
  store: string;
  balance: number;
  checkedInToday?: boolean;
  weeklyCheckinCount?: number;
}

export interface XuTransaction {
  id: string;
  account: string;
  user: string;
  store: string;
  direction: 'credit' | 'debit';
  amount: number;
  reason: string;
  actor?: string;
  referenceType?: string;
  referenceId?: string;
  balanceBefore: number;
  balanceAfter: number;
  created: string;
}

export interface XuTransactionPage {
  page: number;
  perPage: number;
  totalItems: number;
  items: XuTransaction[];
}

export interface XuSettings {
  store: string;
  dailyCheckinReward: number;
  weeklyCheckinReward: number;
  referralReward: number;
  referral5Reward: number;
  referral10Reward: number;
}

export interface XuReward {
  id: string;
  store: string;
  name: string;
  description: string;
  cost: number;
  stock: number;
  active: boolean;
  created: string;
}

export interface XuRedemption {
  id: string;
  user: string;
  store: string;
  reward: string;
  rewardName: string;
  cost: number;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  note: string;
  created: string;
  updated: string;
  username?: string;
  fullname?: string;
}

export interface XuReferralSummary {
  code: string;
  approvedCount: number;
  pendingCount: number;
  milestones: number[];
}

export interface XuCheckinResult {
  checkedIn: boolean;
  alreadyCheckedIn: boolean;
  dailyReward: number;
  weeklyReward: number;
  balance: number;
}

export interface XuAdminUser {
  id: string;
  username: string;
  fullname: string;
  phone: string;
  isApproved: boolean;
  balance: number;
  approvedReferrals: number;
}

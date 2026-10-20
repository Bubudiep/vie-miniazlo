import pb, { Store, User, Product, Table, TableLayout, TableMap, TableBill, TableBillCustomer, TableBillProduct, Customer, WalletOrder, WalletSummary, WalletTransactionPage, WalletUser, XuAdminUser, XuCheckinResult, XuRedemption, XuReferralSummary, XuReward, XuSettings, XuSummary, XuTransactionPage } from './pocketbase';

export const registrationAdminService = {
  get() {
    return pb.send<{ approvalRequired: boolean; users: { id: string; username: string; fullname: string; phone: string }[] }>('/api/admin/registration', { method: 'GET' });
  },
  setApprovalRequired(approvalRequired: boolean) {
    return pb.send('/api/admin/registration', { method: 'PATCH', body: { approvalRequired } });
  },
  approve(id: string) {
    return pb.send(`/api/admin/registration/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  },
};

export const authService = {
  async login(email: string, password: string) {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData;
  },

  async logout() {
    pb.authStore.clear();
  },

  isAuthenticated() {
    return pb.authStore.isValid;
  },

  getToken() {
    return pb.authStore.token;
  },

  getCurrentUser() {
    return pb.authStore.model as User | null;
  }
};

export const storeService = {
  async list(page = 1, perPage = 50) {
    return await pb.collection('stores').getList<Store>(page, perPage, {
      sort: '-created',
    });
  },

  async getOne(id: string) {
    return await pb.collection('stores').getOne<Store>(id);
  },

  async create(data: Partial<Store>) {
    return await pb.collection('stores').create<Store>(data);
  },

  async update(id: string, data: Partial<Store>) {
    return await pb.collection('stores').update<Store>(id, data);
  },

  async delete(id: string) {
    return await pb.collection('stores').delete(id);
  }
};

export const productService = {
  async list(storeId: string, page = 1, perPage = 50) {
    return await pb.collection('products').getList<Product>(page, perPage, {
      filter: `store="${storeId}" && is_active=true`,
      sort: '-created',
    });
  },

  async listAdmin(storeId: string, page = 1, perPage = 100) {
    return await pb.collection('products').getList<Product>(page, perPage, {
      filter: `store="${storeId}"`,
      sort: 'category,name',
    });
  },

  async getOne(id: string) {
    return await pb.collection('products').getOne<Product>(id);
  },

  async create(data: Partial<Product>) {
    return await pb.collection('products').create<Product>(data);
  },

  async update(id: string, data: Partial<Product>) {
    return await pb.collection('products').update<Product>(id, data);
  },

  async delete(id: string) {
    return await pb.collection('products').delete(id);
  }
};

export const tableService = {
  async getMap() {
    return pb.send<TableMap>('/api/table-billing/map', { method: 'GET' });
  },

  async list(storeId: string, page = 1, perPage = 50) {
    return await pb.collection('tables').getList<Table>(page, perPage, {
      filter: `store="${storeId}"`,
      sort: 'row_number,position,name',
    });
  },

  async getOne(id: string) {
    return await pb.collection('tables').getOne<Table>(id);
  },

  async configureLayout(layout: TableLayout) {
    return pb.send<{ ok: boolean }>('/api/table-billing/action', { method: 'POST', body: { action: 'configure_layout', ...layout } });
  },

  async start(tableId: string, customerId = '') {
    return pb.send<{ ok: boolean; billId: string }>('/api/table-billing/action', { method: 'POST', body: { action: 'start', tableId, customerId } });
  },

  async delete(id: string, password: string) {
    return pb.send<{ ok: boolean }>('/api/table-billing/action', { method: 'POST', body: { action: 'delete_table', tableId: id, password } });
  },

  async updateStatus(id: string, status: Table['status']) {
    return pb.send<{ ok: boolean }>('/api/table-billing/action', { method: 'POST', body: { action: 'set_table_status', tableId: id, status } });
  }
};

export const tableBillingService = {
  async getMyOpen() {
    return pb.send<{ items: Pick<TableBill, 'id' | 'table' | 'tableName' | 'status'>[] }>('/api/table-billing/my-open', { method: 'GET' });
  },
  async getDetail(billId: string) {
    return pb.send<TableBill>(`/api/table-billing/detail?billId=${encodeURIComponent(billId)}`, { method: 'GET' });
  },
  async getByTable(tableId: string) {
    return pb.send<TableBill>(`/api/table-billing/detail?tableId=${encodeURIComponent(tableId)}`, { method: 'GET' });
  },
  async getProducts() {
    return pb.send<{ items: TableBillProduct[] }>('/api/table-billing/products', { method: 'GET' });
  },
  async getCustomers() {
    return pb.send<{ items: TableBillCustomer[] }>('/api/table-billing/customers', { method: 'GET' });
  },
  async addItem(billId: string, productId: string, quantity: number) {
    return pb.send<{ ok: boolean; bill: TableBill }>('/api/table-billing/action', { method: 'POST', body: { action: 'add_item', billId, productId, quantity } });
  },
  async updateItem(billId: string, itemId: string, quantity: number) {
    return pb.send<{ ok: boolean; bill: TableBill }>('/api/table-billing/action', { method: 'POST', body: { action: 'update_item', billId, itemId, quantity } });
  },
  async deleteItem(billId: string, itemId: string) {
    return pb.send<{ ok: boolean; bill: TableBill }>('/api/table-billing/action', { method: 'POST', body: { action: 'delete_item', billId, itemId } });
  },
  async requestWallet(billId: string) {
    return pb.send<{ ok: boolean; alreadyRequested: boolean; bill: TableBill }>('/api/table-billing/action', { method: 'POST', body: { action: 'request_wallet', billId } });
  },
  async payManual(billId: string, paymentMethod: 'cash' | 'transfer') {
    return pb.send<{ ok: boolean; bill: TableBill }>('/api/table-billing/action', { method: 'POST', body: { action: 'pay_manual', billId, paymentMethod } });
  },
  async approveWallet(billId: string) {
    return pb.send<{ ok: boolean; alreadyPaid: boolean; promoUsed?: number; mainUsed?: number; error?: string; bill: TableBill }>('/api/table-billing/action', { method: 'POST', body: { action: 'approve_wallet', billId } });
  }
};

export const customerService = {
  async list(storeId: string, page = 1, perPage = 50) {
    return await pb.collection('customers').getList<Customer>(page, perPage, {
      filter: `store="${storeId}"`,
      sort: '-created',
    });
  },

  async getOne(id: string) {
    return await pb.collection('customers').getOne<Customer>(id);
  },

  async create(data: Partial<Customer>) {
    return await pb.collection('customers').create<Customer>(data);
  },

  async update(id: string, data: Partial<Customer>) {
    return await pb.collection('customers').update<Customer>(id, data);
  },

  async delete(id: string) {
    return await pb.collection('customers').delete(id);
  },

  async search(storeId: string, query: string) {
    return await pb.collection('customers').getList<Customer>(1, 20, {
      filter: `store="${storeId}" && (name~"${query}" || phone~"${query}")`,
    });
  }
};

export const walletService = {
  async getMine() {
    return pb.send<WalletSummary>('/api/wallet/me', { method: 'GET' });
  },
  async getMyTransactions(page = 1, perPage = 20) {
    return pb.send<WalletTransactionPage>(`/api/wallet/me/transactions?page=${page}&perPage=${perPage}`, { method: 'GET' });
  },
  async listUsers(query = '') {
    return pb.send<WalletUser[]>(`/api/admin/wallets/users?q=${encodeURIComponent(query)}`, { method: 'GET' });
  },
  async getUser(userId: string) {
    return pb.send<WalletSummary>(`/api/admin/wallets/detail?userId=${encodeURIComponent(userId)}`, { method: 'GET' });
  },
  async getUserTransactions(userId: string, page = 1, perPage = 20) {
    return pb.send<WalletTransactionPage>(`/api/admin/wallets/transactions?userId=${encodeURIComponent(userId)}&page=${page}&perPage=${perPage}`, { method: 'GET' });
  },
  async adjust(input: { userId: string; walletType: 'main' | 'promo'; direction: 'credit' | 'debit'; amount: number; reason: string; expiresAt?: string; idempotencyKey: string }) {
    return pb.send<{ mainBalance: number; promoBalance: number }>('/api/admin/wallets/adjust', { method: 'POST', body: input });
  },
  async updatePromoExpiry(input: { fromDate: string; toDate: string; newExpiresAt: string; userIds?: string[] }) {
    return pb.send<{ updated: number }>('/api/admin/wallets/promo-expiry-bulk', { method: 'POST', body: input });
  },
  async getOrder(orderId: string) {
    return pb.send<WalletOrder>(`/api/orders/detail?orderId=${encodeURIComponent(orderId)}`, { method: 'GET' });
  },
  async payOrder(orderId: string, idempotencyKey: string) {
    return pb.send<{ alreadyPaid: boolean; orderId: string; promoUsed?: number; mainUsed?: number; mainBalance?: number }>('/api/wallet/pay', { method: 'POST', body: { orderId, idempotencyKey } });
  },
};

export const xuService = {
  getMine() {
    return pb.send<XuSummary>('/api/xu/me', { method: 'GET' });
  },
  getTransactions(page = 1, perPage = 20) {
    return pb.send<XuTransactionPage>(`/api/xu/me/transactions?page=${page}&perPage=${perPage}`, { method: 'GET' });
  },
  checkin() {
    return pb.send<XuCheckinResult>('/api/xu/checkin', { method: 'POST', body: {} });
  },
  getReferral() {
    return pb.send<XuReferralSummary>('/api/xu/referral', { method: 'GET' });
  },
  listRewards() {
    return pb.send<XuReward[]>('/api/xu/rewards', { method: 'GET' });
  },
  redeem(rewardId: string, idempotencyKey: string) {
    return pb.send<XuRedemption>('/api/xu/redeem', { method: 'POST', body: { rewardId, idempotencyKey } });
  },
  listRedemptions() {
    return pb.send<XuRedemption[]>('/api/xu/redemptions', { method: 'GET' });
  },
  getAdminSettings() {
    return pb.send<XuSettings>('/api/admin/xu/settings', { method: 'GET' });
  },
  updateAdminSettings(input: Omit<XuSettings, 'store'>) {
    return pb.send<XuSettings>('/api/admin/xu/settings', { method: 'PATCH', body: input });
  },
  listAdminUsers(query = '') {
    return pb.send<XuAdminUser[]>(`/api/admin/xu/users?q=${encodeURIComponent(query)}`, { method: 'GET' });
  },
  adjust(input: { userId: string; direction: 'credit' | 'debit'; amount: number; reason: string; idempotencyKey: string }) {
    return pb.send<XuSummary>('/api/admin/xu/adjust', { method: 'POST', body: input });
  },
  listAdminRewards() {
    return pb.send<XuReward[]>('/api/admin/xu/rewards', { method: 'GET' });
  },
  createReward(input: { name: string; description: string; cost: number; stock: number; active: boolean }) {
    return pb.send<XuReward>('/api/admin/xu/rewards', { method: 'POST', body: input });
  },
  updateReward(id: string, input: Partial<Pick<XuReward, 'name' | 'description' | 'cost' | 'stock' | 'active'>>) {
    return pb.send<XuReward>(`/api/admin/xu/rewards/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
  },
  deactivateReward(id: string) {
    return pb.send<XuReward>(`/api/admin/xu/rewards/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  listAdminRedemptions(status = '') {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return pb.send<(XuRedemption & { username: string })[]>(`/api/admin/xu/redemptions${query}`, { method: 'GET' });
  },
  updateRedemption(id: string, status: 'approved' | 'rejected' | 'fulfilled', note = '') {
    return pb.send<XuRedemption>(`/api/admin/xu/redemptions/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status, note } });
  },
};

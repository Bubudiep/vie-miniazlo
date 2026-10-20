import assert from 'node:assert/strict';

const base = process.env.PB_TEST_URL;
const identity = process.env.PB_TEST_ADMIN;
const password = process.env.PB_TEST_PASSWORD;
if (!base || !identity || !password) throw new Error('Set PB_TEST_URL, PB_TEST_ADMIN and PB_TEST_PASSWORD for an isolated PocketBase database');

async function request(path, method = 'GET', body, token) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}

function expectSuccess(result) {
  assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result));
  return result.data;
}

const admin = expectSuccess(await request('/collections/_superusers/auth-with-password', 'POST', { identity, password })).token;
const stamp = Date.now().toString(36);
const storeA = expectSuccess(await request('/collections/stores/records', 'POST', { name: `Test Store A ${stamp}` }, admin));
const storeB = expectSuccess(await request('/collections/stores/records', 'POST', { name: `Test Store B ${stamp}` }, admin));
const list = expectSuccess(await request('/registration/stores'));
assert.ok(list.some((store) => store.id === storeA.id));
assert.deepEqual(Object.keys(list.find((store) => store.id === storeA.id)).sort(), ['id', 'name']);

async function create(username, store, extras = {}, token) {
  return request('/collections/users/records', 'POST', {
    username, password, passwordConfirm: password, fullname: 'Test Member', phone: '0912345678', store, ...extras,
  }, token);
}
async function login(username) {
  return request('/collections/users/auth-with-password', 'POST', { identity: username, password });
}
const adminAName = `AdminA${stamp}`;
const adminBName = `adminB${stamp}`;
const adminA = expectSuccess(await create(adminAName, storeA.id, { role: 'admin', is_approved: true }, admin));
assert.equal(adminA.username, adminAName.toLowerCase());
expectSuccess(await create(adminBName, storeB.id, { role: 'admin', is_approved: true }, admin));
const tokenA = expectSuccess(await login(adminAName)).token;
const tokenB = expectSuccess(await login(adminBName)).token;
expectSuccess(await login(adminAName.toLowerCase()));
expectSuccess(await login(adminAName.toUpperCase()));
assert.equal((await create(adminAName.toUpperCase(), storeA.id, {}, admin)).status, 400);

assert.equal((await request('/admin/registration')).status, 401);
assert.equal((await request('/admin/registration', 'PATCH', { approvalRequired: true }, tokenB)).status, 200);
assert.equal(expectSuccess(await request('/admin/registration', 'GET', undefined, tokenA)).approvalRequired, false);
const openUser = expectSuccess(await create(`open${stamp}`, storeA.id));
assert.equal(openUser.is_approved, true);
assert.equal(openUser.fullname, 'Test Member');
const openToken = expectSuccess(await login(openUser.username)).token;
assert.equal((await request('/admin/registration', 'GET', undefined, openToken)).status, 403);
assert.equal((await request(`/collections/users/records/${openUser.id}`, 'PATCH', { is_approved: false }, openToken)).status, 400);
assert.equal((await request(`/collections/users/records/${openUser.id}`, 'PATCH', { store: storeB.id }, openToken)).status, 400);
assert.equal((await request(`/collections/users/records/${openUser.id}`, 'PATCH', { role: 'admin' }, openToken)).status, 400);
assert.equal((await request('/collections/stores/records', 'GET', undefined, openToken)).status, 200);
assert.equal((await request(`/collections/stores/records/${storeA.id}`, 'PATCH', { approval_required: true }, openToken)).status, 403);
assert.equal((await request(`/collections/stores/records/${storeA.id}`, 'PATCH', { approval_required: true }, tokenA)).status, 403);
assert.equal((await request('/collections/users/records', 'GET', undefined, openToken)).status, 200);
assert.equal((await request(`/collections/users/records/${adminA.id}`, 'GET', undefined, openToken)).status, 404);
assert.equal((await request('/collections/users/records', 'GET', undefined, tokenA)).data.items.every((item) => item.store === storeA.id), true);
assert.equal((await request(`/collections/users/records/${openUser.id}`, 'GET', undefined, tokenB)).status, 404);

assert.equal((await create(`fake${stamp}`, storeB.id, { role: 'admin', is_approved: true })).status, 400);
assert.equal((await create(`bad${stamp}`, storeB.id, { phone: '12345' })).status, 400);
assert.equal((await create(`noname${stamp}`, storeB.id, { fullname: '   ' })).status, 400);
const waiting = expectSuccess(await create(`wait${stamp}`, storeB.id));
assert.equal(waiting.is_approved, false);
assert.equal((await login(waiting.username)).status, 403);
const pending = expectSuccess(await request('/admin/registration', 'GET', undefined, tokenB));
assert.ok(pending.users.some((user) => user.id === waiting.id && user.fullname === 'Test Member'));
assert.ok(!expectSuccess(await request('/admin/registration', 'GET', undefined, tokenA)).users.some((user) => user.id === waiting.id));
const crossApproval = await request(`/admin/registration/${waiting.id}/approve`, 'POST', undefined, tokenA);
assert.equal(crossApproval.status, 403, JSON.stringify(crossApproval));
expectSuccess(await request(`/admin/registration/${waiting.id}/approve`, 'POST', undefined, tokenB));
assert.equal(expectSuccess(await login(waiting.username)).record.is_approved, true);
assert.equal((await request(`/collections/users/records/${waiting.id}`, 'GET', undefined, openToken)).status, 404);

console.log('Registration and approval checks passed on isolated PocketBase');

/// <reference path="../pb_data/types.d.ts" />

/**
 * Custom endpoints for membership-based authorization
 * Phase 1: Basic endpoints before API Rule lockdown
 */

/**
 * GET /api/custom/memberships/my-memberships
 * List authenticated user's active memberships with expanded store/branch
 */
routerAdd("GET", "/api/custom/memberships/my-memberships", (c) => {
  const authRecord = $apis.requestInfo(c).auth
  if (!authRecord) {
    throw new UnauthorizedError("Authentication required")
  }

  const memberships = $app.dao().findRecordsByFilter(
    "memberships",
    "user = {:user} && active = true",
    "-created",
    -1,
    0,
    { user: authRecord.id }
  )

  const results = []
  for (let i = 0; i < memberships.length; i++) {
    const m = memberships[i]

    let store = null
    try {
      const storeRecord = $app.dao().findRecordById("stores", m.get("store"))
      store = {
        id: storeRecord.id,
        name: storeRecord.get("name"),
        business_code: storeRecord.get("business_code") || "",
        service_type: storeRecord.get("service_type") || ""
      }
    } catch (err) {
      continue
    }

    let branch = null
    const branchId = m.get("branch")
    if (branchId) {
      try {
        const branchRecord = $app.dao().findRecordById("branches", branchId)
        branch = {
          id: branchRecord.id,
          name: branchRecord.get("name"),
          code: branchRecord.get("code") || ""
        }
      } catch (err) {
        // Branch not found, skip
      }
    }

    results.push({
      id: m.id,
      store: store,
      branch: branch,
      role: m.get("role"),
      active: m.getBool("active"),
      created: m.get("created"),
      updated: m.get("updated")
    })
  }

  return c.json(200, results)
}, $apis.requireAuth())

/**
 * POST /api/custom/stores/create
 * Create new store (requires is_system_admin)
 */
routerAdd("POST", "/api/custom/stores/create", (c) => {
  const authRecord = $apis.requestInfo(c).auth
  if (!authRecord) {
    throw new UnauthorizedError("Authentication required")
  }

  if (!authRecord.getBool("is_system_admin")) {
    throw new ForbiddenError("System admin privilege required to create stores")
  }

  const data = $apis.requestInfo(c).data

  if (!data.name) {
    throw new BadRequestError("Store name is required")
  }

  const storeCollection = $app.dao().findCollectionByNameOrId("stores")
  const store = new Record(storeCollection)

  store.set("name", data.name)
  store.set("business_code", data.business_code || "")
  store.set("service_type", data.service_type || "")
  store.set("address", data.address || "")
  store.set("phone", data.phone || "")

  $app.dao().saveRecord(store)

  const membershipCollection = $app.dao().findCollectionByNameOrId("memberships")
  const membership = new Record(membershipCollection)

  membership.set("user", authRecord.id)
  membership.set("store", store.id)
  membership.set("branch", "")
  membership.set("role", "owner")
  membership.set("active", true)

  $app.dao().saveRecord(membership)

  console.log(JSON.stringify({
    action: "store_created",
    admin_user: authRecord.id,
    admin_username: authRecord.get("username"),
    store_id: store.id,
    store_name: data.name,
    membership_id: membership.id,
    timestamp: new Date().toISOString()
  }))

  return c.json(200, {
    store: {
      id: store.id,
      name: store.get("name"),
      business_code: store.get("business_code"),
      service_type: store.get("service_type")
    },
    membership: {
      id: membership.id,
      role: "owner",
      active: true
    }
  })
}, $apis.requireAuth())

/**
 * POST /api/custom/admin/memberships/create
 * Create membership (requires is_system_admin, for bootstrap only)
 */
routerAdd("POST", "/api/custom/admin/memberships/create", (c) => {
  const authRecord = $apis.requestInfo(c).auth
  if (!authRecord) {
    throw new UnauthorizedError("Authentication required")
  }

  if (!authRecord.getBool("is_system_admin")) {
    throw new ForbiddenError("System admin privilege required")
  }

  const data = $apis.requestInfo(c).data

  if (!data.user_id || !data.store_id || !data.role) {
    throw new BadRequestError("user_id, store_id, and role are required")
  }

  const allowedRoles = ["owner", "manager", "cashier", "staff", "customer"]
  if (allowedRoles.indexOf(data.role) === -1) {
    throw new BadRequestError("Invalid role. Allowed: " + allowedRoles.join(", "))
  }

  let targetUser
  try {
    targetUser = $app.dao().findRecordById("users", data.user_id)
  } catch (err) {
    throw new BadRequestError("User not found: " + data.user_id)
  }

  let targetStore
  try {
    targetStore = $app.dao().findRecordById("stores", data.store_id)
  } catch (err) {
    throw new BadRequestError("Store not found: " + data.store_id)
  }

  let targetBranch = null
  if (data.branch_id) {
    try {
      targetBranch = $app.dao().findRecordById("branches", data.branch_id)
    } catch (err) {
      throw new BadRequestError("Branch not found: " + data.branch_id)
    }

    const branchStoreId = targetBranch.get("store")
    if (branchStoreId !== data.store_id) {
      throw new BadRequestError(
        "Branch " + data.branch_id + " does not belong to store " + data.store_id
      )
    }
  }

  const filter = data.branch_id
    ? "user = {:user} && store = {:store} && branch = {:branch}"
    : "user = {:user} && store = {:store} && (branch = '' || branch = null)"

  let existingMembership
  try {
    existingMembership = $app.dao().findFirstRecordByFilter(
      "memberships",
      filter,
      {
        user: data.user_id,
        store: data.store_id,
        branch: data.branch_id || ""
      }
    )
  } catch (err) {
    existingMembership = null
  }

  if (existingMembership) {
    throw new BadRequestError("Membership already exists: " + existingMembership.id)
  }

  const membershipCollection = $app.dao().findCollectionByNameOrId("memberships")
  const membership = new Record(membershipCollection)

  membership.set("user", data.user_id)
  membership.set("store", data.store_id)
  membership.set("branch", data.branch_id || "")
  membership.set("role", data.role)
  membership.set("active", true)

  $app.dao().saveRecord(membership)

  console.log(JSON.stringify({
    action: "membership_created",
    admin_user: authRecord.id,
    admin_username: authRecord.get("username"),
    target_user: data.user_id,
    store: data.store_id,
    branch: data.branch_id || null,
    role: data.role,
    membership_id: membership.id,
    timestamp: new Date().toISOString()
  }))

  return c.json(200, {
    membership_id: membership.id,
    user_id: data.user_id,
    store_id: data.store_id,
    branch_id: data.branch_id || null,
    role: data.role,
    active: true
  })
}, $apis.requireAuth())

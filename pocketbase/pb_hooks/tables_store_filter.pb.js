/// <reference path="../pb_data/types.d.ts" />

/**
 * Server-side store isolation for tables collection
 * Custom endpoint to list tables filtered by user's store
 * Compatible with PocketBase 0.40.4
 */

routerAdd("GET", "/api/store-tables", (c) => {
  const info = $apis.requestInfo(c)

  // Check if user is authenticated
  const authRecord = info.authRecord
  if (!authRecord) {
    return c.json(401, { error: "Authentication required" })
  }

  try {
    // Get user's store
    const userStore = authRecord.get("store")
    if (!userStore) {
      return c.json(403, { error: "User must belong to a store" })
    }

    // Query tables for this store only
    const tables = $app.dao().findRecordsByFilter(
      "tables",
      `store = {:store}`,
      "-created",
      -1,
      0,
      { store: userStore }
    )

    // Convert to JSON
    const items = []
    for (let i = 0; i < tables.length; i++) {
      items.push(tables[i].publicExport())
    }

    return c.json(200, {
      items: items,
      totalItems: tables.length,
      page: 1,
      perPage: items.length,
      totalPages: 1
    })
  } catch (e) {
    console.error("Error fetching store tables:", e)
    return c.json(500, { error: "Internal server error" })
  }
})

/**
 * Prevent cross-store access via update/delete operations
 */
onRecordUpdateRequest((e) => {
  if (e.collection.name !== "tables") {
    return e.next()
  }

  const authRecord = e.httpContext.get("authRecord")
  if (!authRecord || e.hasSuperuserAuth()) {
    return e.next()
  }

  // Check table belongs to user's store
  const userStore = authRecord.get("store")
  const originalTableStore = e.record.original().get("store")

  if (userStore !== originalTableStore) {
    throw new ForbiddenError("You cannot update tables from other stores")
  }

  // Prevent changing store
  const newStore = e.record.get("store")
  if (newStore !== originalTableStore) {
    throw new BadRequestError("Cannot change table's store")
  }

  e.next()
}, "tables")

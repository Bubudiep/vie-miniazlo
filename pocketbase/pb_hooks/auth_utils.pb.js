/// <reference path="../pb_data/types.d.ts" />

/**
 * Authorization utility functions for membership-based access control
 * Phase 1: Basic utilities for custom endpoints
 */

/**
 * Get user's active membership for a specific store and optional branch
 * @param {string} userId - User record ID
 * @param {string} storeId - Store record ID
 * @param {string|null} branchId - Branch record ID or null for store-wide
 * @returns {models.Record|null} Active membership record or null
 */
function getUserActiveMembership(userId, storeId, branchId) {
  if (!userId || !storeId) {
    return null
  }

  const filter = branchId
    ? "user = {:user} && store = {:store} && branch = {:branch} && active = true"
    : "user = {:user} && store = {:store} && (branch = '' || branch = null) && active = true"

  try {
    return $app.dao().findFirstRecordByFilter(
      "memberships",
      filter,
      {
        user: userId,
        store: storeId,
        branch: branchId || ""
      }
    )
  } catch (err) {
    return null
  }
}

/**
 * Check if a role has required permission level
 * @param {string} userRole - User's role (owner|manager|cashier|staff|customer)
 * @param {string} requiredRole - Required role
 * @returns {boolean} True if user role meets or exceeds required role
 */
function hasPermission(userRole, requiredRole) {
  const roleHierarchy = {
    "owner": 5,
    "manager": 4,
    "cashier": 3,
    "staff": 2,
    "customer": 1
  }

  const userLevel = roleHierarchy[userRole] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0

  return userLevel >= requiredLevel
}

/**
 * Check if caller can manage target membership
 * @param {models.Record} callerMembership - Caller's membership record
 * @param {models.Record} targetMembership - Target membership record
 * @returns {boolean} True if caller can manage target
 */
function canManageMembership(callerMembership, targetMembership) {
  if (!callerMembership || !targetMembership) {
    return false
  }

  const callerStore = callerMembership.get("store")
  const targetStore = targetMembership.get("store")

  if (callerStore !== targetStore) {
    return false
  }

  const callerRole = callerMembership.get("role")
  const targetRole = targetMembership.get("role")

  if (callerRole === "owner") {
    return true
  }

  if (callerRole === "manager" && targetRole !== "owner") {
    return true
  }

  return false
}

/**
 * Middleware: Require active membership with minimum role
 * @param {string} requiredRole - Minimum required role
 * @returns {function} Echo middleware function
 */
function requireActiveMembership(requiredRole) {
  return function(next) {
    return function(c) {
      const authRecord = $apis.requestInfo(c).auth
      if (!authRecord) {
        throw new UnauthorizedError("Authentication required")
      }

      const storeId = c.request().header("X-Active-Store")
      const branchId = c.request().header("X-Active-Branch") || null

      if (!storeId) {
        throw new BadRequestError("X-Active-Store header required")
      }

      const membership = getUserActiveMembership(authRecord.id, storeId, branchId)
      if (!membership) {
        throw new ForbiddenError("No active membership found")
      }

      if (requiredRole && !hasPermission(membership.get("role"), requiredRole)) {
        throw new ForbiddenError("Insufficient permissions")
      }

      c.set("activeMembership", membership)

      return next(c)
    }
  }
}

/// <reference path="../pb_data/types.d.ts" />

/**
 * Membership Invariant Hook
 * Enforces: membership.store === membership.branch.store
 * When: membership.branch is not null
 */

onRecordCreateRequest((e) => {
  if (!e.record) {
    return;
  }

  const record = e.record;
  const branchId = record.get("branch");

  // If branch is null/empty, membership is store-wide (allowed)
  if (!branchId || branchId === "") {
    return;
  }

  const membershipStoreId = record.get("store");

  if (!membershipStoreId || membershipStoreId === "") {
    throw new BadRequestError("Membership store is required");
  }

  // Fetch the branch record using DAO with expandFetch
  let branch;
  try {
    branch = $app.findRecordById("branches", branchId);
  } catch (err) {
    throw new BadRequestError("Branch not found: " + branchId);
  }

  const branchStoreId = branch.get("store");

  // Enforce invariant
  if (membershipStoreId !== branchStoreId) {
    throw new BadRequestError(
      "Membership branch must belong to the same store. " +
      "Branch belongs to store '" + branchStoreId + "' " +
      "but membership is for store '" + membershipStoreId + "'"
    );
  }
}, "memberships");

onRecordUpdateRequest((e) => {
  if (!e.record) {
    return;
  }

  const record = e.record;
  const branchId = record.get("branch");

  if (!branchId || branchId === "") {
    return;
  }

  const membershipStoreId = record.get("store");

  if (!membershipStoreId || membershipStoreId === "") {
    throw new BadRequestError("Membership store is required");
  }

  let branch;
  try {
    branch = $app.findRecordById("branches", branchId);
  } catch (err) {
    throw new BadRequestError("Branch not found: " + branchId);
  }

  const branchStoreId = branch.get("store");

  if (membershipStoreId !== branchStoreId) {
    throw new BadRequestError(
      "Membership branch must belong to the same store. " +
      "Branch belongs to store '" + branchStoreId + "' " +
      "but membership is for store '" + membershipStoreId + "'"
    );
  }
}, "memberships");

# CHECKPOINT 6 - PHASE 2 PLANNING

**Date:** 2026-10-10  
**Status:** PLANNING (Implementation awaits approval)  
**Phase 1 Status:** COMPLETE (runtime verification BLOCKED)

---

## EXECUTIVE SUMMARY

### Phase 1 Achievements
- ✅ 5 migrations applied (`is_system_admin`, secure companies/memberships)
- ✅ Hook validation implemented (`users_field_protection.pb.js`)
- ✅ Custom endpoints created (auth_utils, custom_endpoints)
- ✅ Documentation comprehensive
- ⚠️ **Limitation:** Hook validation not runtime-tested with regular users

### Phase 2 Goals (From Phase 1 Documentation)

**From [CHECKPOINT_6_PHASE1_COMPLETE.md](CHECKPOINT_6_PHASE1_COMPLETE.md):**

1. **Phase 2A:** Hook Validation Testing
2. **Phase 2B:** Custom Endpoints Testing  
3. **Phase 2C:** Branches Lockdown
4. **Phase 2D:** System Admin Bootstrap
5. **Phase 2E:** Integration Testing

**From [CHECKPOINT_6_AUTHORIZATION_SECURITY.md](CHECKPOINT_6_AUTHORIZATION_SECURITY.md):**

- Complete authorization architecture with custom endpoints
- Implement invitation system (Decision 4)
- Customer ordering flow (Decision 2)
- Multi-company context switching (Decision 5)

---

## PART 1: BUSINESS DECISIONS REVIEW

### Confirmed Decisions (From Conversation Memory)

| Decision | Choice | Status |
|----------|--------|--------|
| **1. Company Creation** | Invite-only | ✅ CONFIRMED |
| **2. Customer Permissions** | View menu AND create orders | ✅ CONFIRMED |
| **3. Manager Scope** | Cannot create branches | ✅ CONFIRMED |
| **4. Membership Approval** | Invitation link with expiry/limits | ✅ CONFIRMED |
| **5. Multiple Memberships** | Explicit context switch (dropdown) | ✅ CONFIRMED |

### Implementation Impact

**Decision 1 (Invite-only):** Requires `invitations` collection + validation endpoints  
**Decision 2 (Customer orders):** Requires `orders`, `order_items` collections (Phase 3)  
**Decision 3 (Manager limits):** Permission matrix already reflects this  
**Decision 4 (Invitations):** Core Phase 2 requirement  
**Decision 5 (Context switch):** Frontend concern, backend validates headers

---

## PART 2: DEPENDENCY ANALYSIS

### Phase 1 Blockers

**BLOCKER #1:** `users_field_protection.pb.js` not runtime-tested
- **Impact:** Cannot verify regular users cannot self-promote
- **Affects:** Any feature relying on `is_system_admin` or role security
- **Mitigation:** Design/plan work can proceed, deployment waits

**BLOCKER #2:** Custom endpoints not integration-tested
- **Impact:** Authorization logic unverified
- **Affects:** Companies, memberships, branches operations
- **Mitigation:** Can write tests, cannot deploy to production

**BLOCKER #3:** System admin bootstrap undefined
- **Impact:** No mechanism to create first admin
- **Affects:** Admin-only endpoints, invitation system initialization
- **Mitigation:** Manual SQL workaround documented

### Independent Work Streams

**CAN PROCEED:**
- ✅ Schema design (invitations, orders)
- ✅ Test fixture creation
- ✅ Documentation updates
- ✅ API endpoint design
- ✅ Frontend integration planning

**REQUIRES TESTING BUT SAFE:**
- ✅ Branches API lockdown (set rules to NULL)
- ✅ Additional hook validation
- ✅ Migration creation (schema only)

---

## PART 3: WORK CATEGORIZATION

### Category A: Safe to Implement Now

**A1. Lock Branches API Rules**
- **Task:** Create migration to set branches rules to NULL
- **Rationale:** Branches already inaccessible (rules never match), making explicit improves security
- **Risk:** None (already non-functional)
- **Files:** `pb_migrations/17915XXXXX_secure_branches.js`

**A2. Design Invitations Collection**
- **Task:** Create schema and migration for invitations
- **Rationale:** Schema design independent of runtime testing
- **Risk:** None (design phase)
- **Files:** `pb_migrations/17915XXXXX_create_invitations.js`

**A3. Design Orders/Order_Items Collections**
- **Task:** Create schema for customer ordering (Phase 3 prep)
- **Rationale:** Decision 2 confirmed, schema work safe
- **Risk:** None (design phase)
- **Files:** Design doc only, no migration yet

**A4. Test Fixtures with Prefix**
- **Task:** Create test users/companies/branches with `M06_TEST_` prefix
- **Rationale:** Needed for all integration tests
- **Risk:** None (isolated test data)
- **Files:** `scripts/create_test_fixtures.js`

**A5. Documentation Updates**
- **Task:** Document custom endpoints, invitation flow, permission matrix
- **Rationale:** Aligns docs with Phase 1 implementation
- **Risk:** None
- **Files:** `docs/API_ENDPOINTS.md`, `docs/INVITATION_FLOW.md`

---

### Category B: Design/Test Only (No Deployment)

**B1. Hook Validation Test Suite**
- **Task:** Create comprehensive test for `users_field_protection.pb.js`
- **Rationale:** Test harness needed, can be designed now
- **Risk:** Cannot run until test environment resolved
- **Files:** `tests/security/test_field_protection.js`
- **Blocker:** Phase 1D test environment issues

**B2. Custom Endpoints Integration Tests**
- **Task:** Test my-memberships, company creation, admin endpoints
- **Rationale:** Endpoints exist, tests verify authorization
- **Risk:** Cannot run on production, needs isolated env
- **Files:** `tests/integration/test_custom_endpoints.js`
- **Blocker:** Requires test environment with hooks

**B3. Invitation System Implementation**
- **Task:** Create endpoints, validation logic, expiry handling
- **Rationale:** Decision 4 confirmed, logic can be written
- **Risk:** **CANNOT DEPLOY** - depends on system admin bootstrap
- **Files:** `pb_hooks/invitation_endpoints.pb.js`
- **Blocker:** No way to create invitations without admin

**B4. Branches Custom Endpoints**
- **Task:** Implement POST /api/custom/branches/create with role checks
- **Rationale:** Replaces non-functional API Rules
- **Risk:** **CANNOT DEPLOY** - authorization untested
- **Files:** `pb_hooks/branches_endpoints.pb.js` (or extend custom_endpoints)
- **Blocker:** Custom endpoint auth not verified

---

### Category C: Blocked Until Phase 1D Resolved

**C1. System Admin Bootstrap Endpoint**
- **Task:** POST /api/custom/admin/bootstrap with strong auth
- **Rationale:** Required to initialize system
- **Risk:** **HIGH** - creates first privileged user
- **Files:** Extension to `pb_hooks/custom_endpoints.pb.js`
- **Blocker:** Cannot test self-promotion protection
- **Dependency:** Must verify `users_field_protection.pb.js` works first

**C2. Production Deployment of Custom Endpoints**
- **Task:** Enable custom endpoints on production
- **Rationale:** Core authorization mechanism
- **Risk:** **CANNOT DEPLOY** - auth logic unverified
- **Blocker:** No runtime verification of authorization checks
- **Dependency:** Must complete integration tests (B2) first

**C3. Frontend Migration to Memberships**
- **Task:** Update AuthContext, add company selector, send headers
- **Rationale:** Frontend depends on backend authorization working
- **Risk:** **CANNOT DEPLOY** - backend unverified
- **Blocker:** Custom endpoints must be tested and deployed first
- **Dependency:** B2, C2 complete

**C4. User Profile Update Endpoints**
- **Task:** Custom endpoint for safe profile updates (bypass direct API)
- **Rationale:** Defense in depth (hook is single point of failure)
- **Risk:** **MEDIUM** - reduces attack surface
- **Blocker:** Hook validation not tested
- **Recommendation:** Implement as defense-in-depth even if hook works

---

## PART 4: PHASE 2 MILESTONES (PROPOSED)

### Milestone 2.1: Foundations (Safe Work)
**Goal:** Complete all work that doesn't require runtime verification

**Deliverables:**
1. ✅ Lock branches API Rules (migration)
2. ✅ Design invitations collection schema
3. ✅ Create test fixtures script
4. ✅ Update API documentation
5. ✅ Design orders/order_items schema (prep Phase 3)

**Timeline:** 1-2 days  
**Risk:** LOW  
**Blockers:** None

---

### Milestone 2.2: Test Infrastructure
**Goal:** Create reproducible test environment for security validation

**Deliverables:**
1. ✅ Docker-based test environment (or alternative)
2. ✅ Hook validation test suite
3. ✅ Custom endpoints integration tests
4. ✅ Test runner with cleanup

**Timeline:** 2-3 days  
**Risk:** MEDIUM (test env setup failed in Phase 1D)  
**Blockers:** Must resolve root cause of Phase 1D failures

**Options for Test Environment:**
- **Option A:** Docker container with PocketBase + hooks
- **Option B:** Dedicated test PocketBase instance (separate port/DB)
- **Option C:** Manual supervised test on production (1 test user)

**Recommendation:** Option A (Docker) for isolation, Option C as fallback

---

### Milestone 2.3: Runtime Verification
**Goal:** Execute tests and verify hook/endpoint security

**Deliverables:**
1. ✅ Run hook validation tests (Category B1)
2. ✅ Run custom endpoint tests (Category B2)
3. ✅ Document test results
4. ✅ Fix any identified issues

**Timeline:** 1-2 days  
**Risk:** HIGH (depends on M2.2 success)  
**Blockers:** Milestone 2.2 complete  
**Success Criteria:**
- Regular users cannot self-promote (hook test PASS)
- Custom endpoints enforce authorization (integration test PASS)
- No bypass routes found

---

### Milestone 2.4: System Admin Bootstrap
**Goal:** Implement controlled admin provisioning

**Deliverables:**
1. ✅ POST /api/custom/admin/bootstrap endpoint
2. ✅ Strong authentication (token, manual approval, etc.)
3. ✅ Audit logging
4. ✅ Test with test fixtures
5. ✅ Documentation

**Timeline:** 1-2 days  
**Risk:** MEDIUM  
**Blockers:** Milestone 2.3 complete (hook verified)  
**Success Criteria:**
- Can create first system admin securely
- Cannot be abused by regular users
- Audit trail exists

---

### Milestone 2.5: Invitation System
**Goal:** Implement invite-based company membership

**Deliverables:**
1. ✅ `invitations` collection migration
2. ✅ POST /api/custom/invitations/create (admin only)
3. ✅ POST /api/custom/invitations/accept (public)
4. ✅ Expiry and usage limit validation
5. ✅ Integration tests
6. ✅ Documentation

**Timeline:** 2-3 days  
**Risk:** MEDIUM  
**Blockers:** Milestone 2.4 complete (admin exists)  
**Success Criteria:**
- Admins can create invitations
- Users can accept invitations
- Expired/used invitations rejected
- Company creation is invite-only

---

### Milestone 2.6: Branches Operations
**Goal:** Implement custom endpoints for branch management

**Deliverables:**
1. ✅ POST /api/custom/branches/create
2. ✅ PATCH /api/custom/branches/{id}/update
3. ✅ DELETE /api/custom/branches/{id}
4. ✅ Authorization checks (owner/manager scope)
5. ✅ Integration tests

**Timeline:** 1-2 days  
**Risk:** LOW  
**Blockers:** Milestone 2.3 complete  
**Success Criteria:**
- Owners can create branches
- Managers cannot (per Decision 3)
- Scope validation works

---

### Milestone 2.7: Integration & Deployment
**Goal:** Deploy to production with monitoring

**Deliverables:**
1. ✅ Final regression tests
2. ✅ Production deployment
3. ✅ Monitoring setup (auth failures, unusual activity)
4. ✅ Rollback procedure documented
5. ✅ User migration guide (if needed)

**Timeline:** 1 day  
**Risk:** MEDIUM  
**Blockers:** All prior milestones complete  
**Success Criteria:**
- Production runs without errors
- Authorization working as designed
- No security incidents

---

## PART 5: TEST STRATEGY REFINEMENT

### Test Harness Requirements

**Lessons from Phase 1D:**
1. ❌ Bash + grep JSON parsing failed
2. ❌ Database copy approach caused locks
3. ❌ Test instances not cleaned up properly
4. ✅ PowerShell + ConvertFrom-Json worked

**Phase 2 Test Harness Design:**

**Option A: Docker Container** (RECOMMENDED)
```yaml
# docker-compose.test.yml
services:
  pocketbase:
    image: ghcr.io/muchobien/pocketbase:0.40.4
    ports:
      - "9999:8090"
    volumes:
      - ./pb_hooks:/pb/pb_hooks:ro
      - ./pb_migrations:/pb/pb_migrations:ro
      - test_data:/pb/pb_data
    command: serve --http=0.0.0.0:8090
volumes:
  test_data:
```

**Advantages:**
- ✅ Complete isolation (no production impact)
- ✅ Fresh database every run
- ✅ Hooks guaranteed loaded
- ✅ Easy cleanup (docker-compose down -v)
- ✅ Reproducible environment

**Option B: Dedicated Test Instance**
```bash
# Separate PocketBase on port 9999
# Dedicated pb_data_test directory
# Manually managed lifecycle
```

**Advantages:**
- ✅ No Docker dependency
- ✅ Simpler setup
- ❌ Requires manual cleanup
- ❌ Risk of port conflicts

**Option C: Manual Supervised Testing**
```bash
# Create 1 test user on production
# User performs attacks under supervision
# Verify database unchanged
# Delete test user
```

**Advantages:**
- ✅ Tests real production environment
- ✅ No test infrastructure needed
- ❌ Requires user involvement
- ❌ Risk if test fails

**Recommendation:** Start with Option A (Docker), fallback to Option C if Docker unavailable.

---

### Test Fixtures Design

**Prefix:** All test data uses `M06_TEST_` prefix

**Companies:**
```javascript
{
  id: "M06_TEST_COMPANY_A",
  name: "M06 Test Alpha Corp"
}
{
  id: "M06_TEST_COMPANY_B",
  name: "M06 Test Beta Inc"
}
```

**Users:**
```javascript
{
  username: "m06_test_owner_a",
  email: "m06_owner_a@test.example",
  password: "TestPass123!",
  is_system_admin: false
}
{
  username: "m06_test_sysadmin",
  email: "m06_admin@test.example",
  is_system_admin: true  // Created via SQL for bootstrap test
}
```

**Branches:**
```javascript
{
  id: "M06_TEST_BRANCH_A1",
  company: "M06_TEST_COMPANY_A",
  name: "Test HQ",
  code: "HQ"
}
```

**Memberships:**
```javascript
{
  user: <m06_test_owner_a_id>,
  company: "M06_TEST_COMPANY_A",
  branch: null,  // company-wide
  role: "owner",
  active: true
}
```

**Cleanup Script:**
```sql
DELETE FROM users WHERE username LIKE 'M06_TEST_%' OR username LIKE 'm06_test_%';
DELETE FROM companies WHERE name LIKE 'M06 Test%' OR name LIKE 'M06_TEST_%';
DELETE FROM branches WHERE name LIKE 'Test %' OR code LIKE 'TEST_%';
DELETE FROM memberships WHERE user IN (SELECT id FROM users WHERE username LIKE 'm06_test_%');
```

---

## PART 6: RISK ASSESSMENT

### High-Risk Items (Require Extra Care)

**HR-1: System Admin Bootstrap**
- **Risk:** First privileged user creation
- **Mitigation:** Strong auth, audit log, rate limiting, manual approval
- **Test:** Attempt unauthorized access, verify rejection

**HR-2: Invitation Acceptance**
- **Risk:** Attackers could abuse invite codes
- **Mitigation:** Expiry, usage limits, company validation
- **Test:** Expired invite, over-limit invite, wrong company

**HR-3: Custom Endpoint Authorization**
- **Risk:** Bypass could grant unauthorized access
- **Mitigation:** Thorough testing, multiple validation layers
- **Test:** Cross-tenant access, role escalation, scope violations

### Medium-Risk Items

**MR-1: Hook Validation**
- **Risk:** Single point of failure if hook doesn't execute
- **Mitigation:** Runtime testing, defense-in-depth endpoints
- **Test:** Hook execution verification, fallback behavior

**MR-2: Test Environment**
- **Risk:** Test failures could block Phase 2
- **Mitigation:** Multiple options (Docker, dedicated, manual)
- **Contingency:** Supervised manual testing as last resort

### Low-Risk Items

**LR-1: Branches Lockdown**
- **Risk:** None (already non-functional)
- **Verification:** Confirm locked status

**LR-2: Documentation**
- **Risk:** None
- **Quality:** Peer review

---

## PART 7: BLOCKERS AND MITIGATION

### Current Blockers

| Blocker | Affects | Severity | Mitigation |
|---------|---------|----------|------------|
| Phase 1D test env failure | Security verification | HIGH | Docker alternative (M2.2) |
| Hook not runtime-tested | All auth features | HIGH | Resolve in M2.3 |
| No system admin | Invitation system | MEDIUM | Bootstrap in M2.4 |
| Custom endpoints untested | Production deployment | HIGH | Integration tests M2.3 |

### Mitigation Strategies

**For Test Environment:**
1. Try Docker container approach
2. If Docker fails, dedicated test instance
3. If both fail, supervised manual testing
4. Document root cause for future

**For Hook Validation:**
1. Must achieve runtime verification
2. If impossible, add defense-in-depth (custom endpoints)
3. Document limitation
4. Monitor production for anomalies

**For System Admin:**
1. Bootstrap endpoint with strong auth
2. Manual SQL as temporary workaround
3. Document process
4. Audit all admin grants

---

## PART 8: OUT OF SCOPE FOR PHASE 2

### Explicitly Deferred to Phase 3+

**Phase 3: Customer Ordering**
- `orders` and `order_items` collections
- Customer self-service ordering flow
- Price validation server-side
- Order status workflow

**Phase 4: Resource Branch Assignment**
- Add `branch` field to products, tables, customers
- Migrate existing data
- Update API Rules for branch scope

**Phase 5: Deprecate Legacy Fields**
- Remove `users.company` and `users.role`
- Frontend migration complete
- No code references

### Not Planned

- ❌ Zalo OAuth improvements (working, out of scope)
- ❌ Frontend UI implementation (separate project)
- ❌ Performance optimization (premature)
- ❌ Multi-language support (not requested)
- ❌ Advanced audit logging (basic only)

---

## PART 9: DECISION POINTS FOR USER

### Required Approvals

**DA-1: Test Environment Approach**
- **Question:** Docker, dedicated instance, or manual supervised?
- **Recommendation:** Docker for isolation
- **Impact:** Affects M2.2 timeline

**DA-2: System Admin Bootstrap Method**
- **Question:** Endpoint auth mechanism (token, manual, other)?
- **Recommendation:** Secure token + manual approval first time
- **Impact:** Affects M2.4 security model

**DA-3: Hook Validation Fallback**
- **Question:** If runtime test fails again, accept code review only?
- **Recommendation:** Add defense-in-depth endpoints, document limitation
- **Impact:** Security posture decision

**DA-4: Phase 2 Scope**
- **Question:** Implement all milestones or prioritize subset?
- **Options:**
  - **Full:** M2.1 through M2.7 (2-3 weeks)
  - **Core:** M2.1, M2.2, M2.3 only (verification only, ~1 week)
  - **Minimal:** M2.1 only (safe work, 1-2 days)
- **Recommendation:** Core first, then assess blockers

---

## PART 10: SUCCESS CRITERIA

### Phase 2 Complete When:

**Security:**
- [ ] Hook validation runtime-tested (regular user tokens)
- [ ] Custom endpoints authorization verified
- [ ] No bypass routes identified
- [ ] System admin bootstrap secure

**Functionality:**
- [ ] Companies/memberships locked via NULL rules
- [ ] Branches locked and custom endpoints functional
- [ ] Invitation system working end-to-end
- [ ] Test fixtures exist and cleanup works

**Documentation:**
- [ ] All custom endpoints documented
- [ ] Invitation flow documented
- [ ] Test procedures documented
- [ ] Rollback procedures documented

**Testing:**
- [ ] Test environment reproducible
- [ ] Integration tests passing
- [ ] Security tests passing
- [ ] Regression tests passing

---

## PART 11: NEXT STEPS

### Immediate Actions (Awaiting User Decision)

1. **Approve Phase 2 scope** (Full/Core/Minimal per DA-4)
2. **Select test environment approach** (DA-1)
3. **Review and approve milestone plan**
4. **Authorize start of M2.1 (safe work)**

### After Approval

1. Create task list for approved milestones
2. Start M2.1 (lock branches, design schemas, fixtures)
3. Begin test environment setup (M2.2)
4. Prepare integration test suite
5. Document progress and blockers

---

## SUMMARY

**Phase 2 Status:** READY FOR PLANNING APPROVAL

**Blockers:** Phase 1D runtime verification incomplete  
**Mitigation:** Design/test work can proceed, deployment waits  
**Risk:** MEDIUM (test environment uncertainty)  
**Timeline:** 1-3 weeks depending on scope

**Recommendation:** Start with **Core scope** (M2.1-M2.3) to resolve blockers, then reassess for M2.4-M2.7.

---

**Phase 2 Planning Complete - Awaiting User Approval**

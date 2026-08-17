import test from "node:test";
import assert from "node:assert/strict";
import { isSuperAdminRole, SUPER_ADMIN_ROLE } from "../lib/admin-role";

test("only the explicit super-admin role grants console access", () => {
  assert.equal(isSuperAdminRole(SUPER_ADMIN_ROLE), true);
  assert.equal(isSuperAdminRole("admin"), false);
  assert.equal(isSuperAdminRole("user"), false);
  assert.equal(isSuperAdminRole(undefined), false);
});

export const SUPER_ADMIN_ROLE = "super_admin" as const;

export function isSuperAdminRole(role: unknown): role is typeof SUPER_ADMIN_ROLE {
  return role === SUPER_ADMIN_ROLE;
}

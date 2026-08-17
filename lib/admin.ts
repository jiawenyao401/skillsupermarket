import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser, getCurrentSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { isSuperAdminRole } from "@/lib/admin-role";

export const isSuperAdminUser = cache(async (userId: string): Promise<boolean> => {
  const [record] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return isSuperAdminRole(record?.role);
});

export async function getCurrentAdmin() {
  const session = await getCurrentSession();
  if (!session || !(await isSuperAdminUser(session.user.id))) return null;
  return session;
}

export async function requireSuperAdmin(returnTo = "/admin") {
  const session = await requireUser(returnTo);
  if (!(await isSuperAdminUser(session.user.id))) notFound();
  return session;
}

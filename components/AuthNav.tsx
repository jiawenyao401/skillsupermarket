import Link from "next/link";
import { ChartNoAxesCombined, LogIn, UserRound } from "lucide-react";
import { getCurrentSession } from "@/lib/auth-session";
import { isSuperAdminUser } from "@/lib/admin";
import { LogoutButton } from "@/components/LogoutButton";

export async function AuthNav() {
  const session = await getCurrentSession();

  if (!session) {
    return <Link href="/login?returnTo=%2Fevaluate" className="hidden h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold transition-colors hover:border-primary/40 sm:inline-flex"><LogIn className="h-3.5 w-3.5" /> 登录</Link>;
  }

  const isSuperAdmin = await isSuperAdminUser(session.user.id);

  return (
    <div className="hidden items-center gap-2 sm:flex">
      {isSuperAdmin && (
        <Link href="/admin" className="flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-bold text-background transition-opacity hover:opacity-85">
          <ChartNoAxesCombined className="h-3.5 w-3.5" />
          运营后台
        </Link>
      )}
      <Link href="/account" className="flex h-9 max-w-40 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold transition-colors hover:border-primary/40" title={`${session.user.email} · 打开个人中心`}>
        <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{session.user.name}</span>
      </Link>
      <LogoutButton />
    </div>
  );
}

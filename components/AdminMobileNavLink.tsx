import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { getCurrentAdmin } from "@/lib/admin";

export async function AdminMobileNavLink() {
  if (!(await getCurrentAdmin())) return null;
  return <Link href="/admin" className="mobile-nav-link"><ChartNoAxesCombined className="h-4 w-4" />运营后台</Link>;
}

import Link from "next/link";
import type { ReactNode } from "react";
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <><header><strong>AppsInHours</strong><nav><Link href="/">Home</Link><Link href="/work">Work</Link><Link href="/app/account">Account</Link></nav></header><main>{children}</main></>;
}

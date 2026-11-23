import type { ReactNode } from "react";
export const metadata = { robots: { index: false, follow: false } };
export default function ProductLayout({ children }: { children: ReactNode }) {
  return <div className="product-shell"><header><strong>AppsInHours workspace</strong></header><main>{children}</main></div>;
}

import type { ReactNode } from "react";
import ProductProvider from "@/provider";
import "../product.css";
export const metadata = { robots: { index: false, follow: false } };
export default function ProductLayout({ children }: { children: ReactNode }) {
  return <ProductProvider>{children}</ProductProvider>;
}

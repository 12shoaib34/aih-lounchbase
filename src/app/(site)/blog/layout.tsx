import type { ReactNode } from "react";
import "./blog.css";
export default function BlogLayout({children}:{children:ReactNode}) {
  return <main id="main" tabIndex={-1}>{children}</main>;
}

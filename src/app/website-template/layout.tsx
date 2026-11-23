import type { ReactNode } from "react";
import Link from "next/link";
import { websiteTemplate as site } from "../../site/template/config";
import "../../site/template/template.css";

export const metadata = { robots: { index: false, follow: false } };
export default function WebsiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="enquiry-template">
      <header>{site.name}</header>
      <main>{children}</main>
      <footer>
        <Link href="/app/account/enquiries">Track an existing enquiry</Link>
      </footer>
    </div>
  );
}

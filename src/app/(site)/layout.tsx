import type { ReactNode } from "react";
import Shell from "../../site/shell";
const styles = [
  "style",
  "refinement",
  "marketing",
  "experience",
  "onepage",
  "detail",
  "engagements",
  "studio",
  "work",
  "ventures",
  "privacy-page",
  "contact-page",
  "brand",
  "ui-system",
  "opening-loader",
];
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {styles.map((name) => (
        <link rel="stylesheet" key={name} href={"/site/" + name + ".css"} />
      ))}
      <Shell>{children}</Shell>
    </>
  );
}

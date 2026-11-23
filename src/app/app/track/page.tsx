import Tracking from "./tracking";
import "../../../site/template/template.css";
export const metadata = {
  title: "Track your enquiry",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return (
    <main className="enquiry-template">
      <h1>Track your enquiry</h1>
      <Tracking />
    </main>
  );
}

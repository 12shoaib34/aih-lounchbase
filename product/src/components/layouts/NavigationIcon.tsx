const paths: Record<string, string> = {
  website: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
  menu: "M4 6h16M4 12h16M4 18h16",
  collapse: "M3 4h18v16H3V4Zm5 0v16m8-12-4 4 4 4",
  expand: "M3 4h18v16H3V4Zm5 0v16m5-12 4 4-4 4",
  team: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0m2-16a4 4 0 0 1 0 8m2 2a6 6 0 0 1 6 6",
  accounts: "M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  security: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-3 9 2 2 4-4",
  "two-factor": "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3",
  billing: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
  notifications: "M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2V9Zm4 11h4",
  inquiries: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
  contacts:
    "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0m2-15h6m-6 5h6m-6 5h6",
  business: "M4 21V4h12v17M8 8h4m-4 4h4m-4 4h4m4-6h4v11M2 21h20",
  audit: "M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4",
  admin: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
};
export function NavigationIcon({ to }: { to: string }) {
  const key = to.split("/").at(-1) ?? "";
  return (
    <svg
      className="navigation-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[key] ?? "M3 6h7l2 2h9v12H3V6Zm0 0V4h7l2 2"} />
    </svg>
  );
}

export const customerNavigation = [
  { to: "/account", label: "Profile", end: true, group: "" },
  { to: "/workspace", label: "My records", end: true, group: "Workspace" },
  { to: "/account/bookings", label: "My bookings", group: "Workspace" },
  { to: "/account/billing", label: "My billing", group: "Workspace" },
  { to: "/account/notifications", label: "Notifications", group: "Workspace" },
  { to: "/account/security", label: "Account security", group: "Account" },
  {
    to: "/account/two-factor",
    label: "Two-factor authentication",
    group: "Account",
  },
];

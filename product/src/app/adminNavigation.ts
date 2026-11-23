import type { Permission } from "../../shared/access";

// App composition: clients can add feature destinations without editing the shell.
const destinations: {
  to: string;
  label: string;
  group: string;
  permission?: Permission;
  ownerOnly?: boolean;
}[] = [
  {
    to: "/admin/contacts",
    label: "Contacts",
    group: "Business",
    permission: "contacts:read",
  },
  {
    to: "/admin/files",
    label: "Files",
    group: "Workspace",
    permission: "files:read",
  },
  {
    to: "/admin/accounts",
    label: "Accounts",
    group: "Administration",
    permission: "users:read",
  },
  {
    to: "/admin/team",
    label: "Team",
    group: "Administration",
    ownerOnly: true,
  },
  {
    to: "/admin/business",
    label: "Business settings",
    group: "Administration",
    ownerOnly: true,
  },
  {
    to: "/admin/audit",
    label: "Audit trail",
    group: "Administration",
    ownerOnly: true,
  },
];
export function adminNavigation(access?: {
  teamRole: "owner" | "staff" | null;
  permissions: readonly Permission[];
}) {
  return [
    { to: "/admin", label: "Overview", end: true, group: "" },
    ...destinations
      .filter(
        (link) =>
          access?.teamRole === "owner" ||
          (access?.teamRole === "staff" &&
            !link.ownerOnly &&
            !!link.permission &&
            access.permissions.includes(link.permission)),
      )
      .map(({ to, label, group }) => ({ to, label, group })),
  ];
}

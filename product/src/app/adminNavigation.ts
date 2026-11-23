import type { Permission } from "../../shared/access";

// App composition: clients can add feature destinations without editing the shell.
const destinations: {
  to: string;
  label: string;
  group: string;
  permission?: Permission;
  ownerOnly?: boolean;
}[] = [];
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

import { customerNavigation } from "@/app/customerNavigation";
import type { ReactNode } from "react";
import { WorkspaceFrame } from "@/app/WorkspaceFrame";

export function CustomerFrame({ children }: { children: ReactNode }) {
  return (
    <WorkspaceFrame
      title="My workspace"
      context="Customer workspace"
      links={customerNavigation}
    >
      <div className="customer-content">{children}</div>
    </WorkspaceFrame>
  );
}

import { createContext } from "react";

// Feature headers can render their live trail into the shared shell's slot.
export const WorkspaceBreadcrumbContext = createContext<{
  target: HTMLDivElement | null;
} | null>(null);

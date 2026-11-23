import { create } from "zustand";

export type WorkspaceLink = {
  to: string;
  label: string;
  end?: boolean;
  group?: string;
};
type NavigationSnapshot = {
  userId: string;
  context: string;
  links: readonly WorkspaceLink[];
};

const preferenceKey = "launchbase:sidebar-collapsed";
function readCollapsed() {
  try {
    return localStorage.getItem(preferenceKey) === "true";
  } catch {
    return false;
  }
}

// Only collapse is persisted. Navigation labels are an in-memory, user-scoped visual snapshot, never an authorization result.
export const useUiStore = create<{
  navigation: NavigationSnapshot | null;
  rememberNavigation: (navigation: NavigationSnapshot | null) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}>((set) => ({
  navigation: null,
  rememberNavigation: (navigation) =>
    set((state) =>
      JSON.stringify(state.navigation) === JSON.stringify(navigation)
        ? state
        : { navigation },
    ),
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () =>
    set((state) => {
      const sidebarCollapsed = !state.sidebarCollapsed;
      try {
        localStorage.setItem(preferenceKey, String(sidebarCollapsed));
      } catch {
        /* Works in memory when storage is unavailable. */
      }
      return { sidebarCollapsed };
    }),
}));

export type WorkspaceContext = "admin" | "customer";
const key = "launchbase:workspace-context";
let memory: { userId: string; workspace: WorkspaceContext } | null = null;

export function readWorkspaceContext(userId?: string): WorkspaceContext | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      saved &&
      typeof saved.userId === "string" &&
      (saved.workspace === "admin" || saved.workspace === "customer")
    )
      memory = saved;
  } catch {
    /* Storage is optional presentation state. */
  }
  return memory && memory.userId === userId
    ? memory.workspace
    : null;
}

export function rememberWorkspaceContext(
  userId: string,
  workspace: WorkspaceContext,
) {
  memory = { userId, workspace };
  try {
    sessionStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* Keep in memory. */
  }
}

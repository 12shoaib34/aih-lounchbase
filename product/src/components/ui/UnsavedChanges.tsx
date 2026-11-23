import { useEffect } from "react";
import { useBlocker } from "@/navigation";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

export function UnsavedChanges({
  dirty,
  pending = false,
  pendingMessage = "Wait for the save to finish.",
  onDiscard,
}: {
  dirty: boolean;
  pending?: boolean;
  pendingMessage?: string;
  onDiscard?: () => void;
}) {
  const blocker = useBlocker(dirty || pending);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const preventSessionEnd = (event: Event) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    window.addEventListener("launchbase:before-session-end", preventSessionEnd);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener(
        "launchbase:before-session-end",
        preventSessionEnd,
      );
    };
  }, [dirty, pending]);
  return blocker.state === "blocked" ? (
    <Dialog
      open
      title="Leave this page?"
      className="dialog-confirmation"
      onClose={() => blocker.reset()}
      description={
        pending ? pendingMessage : "Your unsaved changes will be lost."
      }
      actions={
        <>
          <Button onClick={() => blocker.reset()}>Keep editing</Button>
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => {
              onDiscard?.();
              blocker.proceed();
            }}
          >
            Discard and leave
          </Button>
        </>
      }
    >
      {null}
    </Dialog>
  ) : null;
}

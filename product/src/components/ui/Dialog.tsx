import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  description,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  description?: string;
  className?: string;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = element.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const invoker = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      // Conditional dialogs can unmount without an open=false render. Close the
      // native modal as well, then restore focus if removal left it on the body.
      if (dialog.open) dialog.close();
      if (
        invoker instanceof HTMLElement &&
        invoker.isConnected &&
        document.activeElement === document.body
      )
        invoker.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      ref={element}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <h2 id={titleId}>{title}</h2>
      {description && (
        <p id={descriptionId} className="dialog-description">
          {description}
        </p>
      )}
      {children}
      {actions !== null && (
        <div className="dialog-actions">
          {actions === undefined ? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          ) : (
            actions
          )}
        </div>
      )}
    </dialog>
  );
}

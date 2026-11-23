import {
  ConfirmationContext,
  type Options,
  type Service,
} from "./useConfirmation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Field } from "./Field";

type Request = Options & {
  message: string;
  owner: string;
  resolve: (value: string | null) => void;
};
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const current = useRef<Request | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const formId = useId();
  const finish = useCallback((result: string | null) => {
    const pending = current.current;
    current.current = null;
    setRequest(null);
    pending?.resolve(result);
  }, []);
  const service = useMemo<Service>(
    () => ({
      ask: (message, options, owner) => {
        // A modal blocks other interactions; never replace an unresolved decision.
        if (current.current) return Promise.resolve(null);
        return new Promise((resolve) => {
          const next = { ...options, message, owner, resolve };
          current.current = next;
          setValue("");
          setRequest(next);
        });
      },
      cancel: (owner) => {
        if (current.current?.owner === owner) finish(null);
      },
    }),
    [finish],
  );
  useEffect(
    () => () => {
      current.current?.resolve(null);
      current.current = null;
    },
    [],
  );
  return (
    <ConfirmationContext.Provider value={service}>
      {children}
      {request && (
        <Dialog
          open
          title={request.title}
          description={request.message}
          className="dialog-confirmation"
          onClose={() => finish(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => finish(null)}>
                Cancel
              </Button>
              <Button
                data-confirm-action
                type="submit"
                form={formId}
                disabled={!!request.inputLabel && !value.trim()}
              >
                {request.confirmLabel}
              </Button>
            </>
          }
        >
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              if (!request.inputLabel || value.trim())
                finish(request.inputLabel ? value.trim() : "confirmed");
            }}
          >
            {request.inputLabel && (
              <Field
                label={request.inputLabel}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                autoComplete="off"
              />
            )}
          </form>
        </Dialog>
      )}
    </ConfirmationContext.Provider>
  );
}

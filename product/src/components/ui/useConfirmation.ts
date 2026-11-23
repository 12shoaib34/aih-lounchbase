import { createContext, useContext, useEffect, useId, useMemo } from "react";
export type Options = {
  title: string;
  confirmLabel: string;
  inputLabel?: string;
};
export type Service = {
  ask: (
    message: string,
    options: Options,
    owner: string,
  ) => Promise<string | null>;
  cancel: (owner: string) => void;
};
export const ConfirmationContext = createContext<Service | null>(null);

export function useConfirmation() {
  const service = useContext(ConfirmationContext);
  if (!service) throw new Error("ConfirmationProvider is required");
  const owner = useId();
  useEffect(() => () => service.cancel(owner), [service, owner]);
  return useMemo(
    () => ({
      confirm: async (message: string, options: Options) =>
        (await service.ask(message, options, owner)) !== null,
      prompt: (message: string, options: Options) =>
        service.ask(message, options, owner),
    }),
    [service, owner],
  );
}

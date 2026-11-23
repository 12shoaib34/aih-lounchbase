import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { accountChoicesSchema } from "../../../shared/access";

export type InvoiceCustomer = { id: string; name: string; email?: string };
export function InvoiceCustomerPicker({
  userId,
  selected,
  onSelect,
  error,
  disabled = false,
}: {
  userId: string;
  selected: InvoiceCustomer | null;
  onSelect: (customer: InvoiceCustomer | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();

  const change = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = useQuery({
    queryKey: ["owner", "invoice-customers", userId, search],
    enabled: !selected && open && !disabled,
    queryFn: ({ signal }) =>
      apiRequest(
        `/admin/account-choices?${new URLSearchParams({ search, purpose: "billing" })}`,
        { signal },
        accountChoicesSchema,
      ),
    retry: false,
    gcTime: 0,
  });
  const items = query.data?.items ?? [];
  function choose(customer: InvoiceCustomer) {
    onSelect(customer);
    setOpen(false);
    setActive(-1);
    requestAnimationFrame(() => change.current?.focus());
  }
  return selected ? (
    <div className="invoice-customer-selected">
      <strong>{selected.name}</strong>
      {selected.email && <p>{selected.email}</p>}
      <button
        ref={change}
        aria-label="Change customer"
        className="button button-secondary"
        type="button"
        disabled={disabled}
        onClick={() => {
          onSelect(null);
          setSearch("");
          setActive(-1);
          setOpen(true);
          requestAnimationFrame(() =>
            document.getElementById(`${id}-input`)?.focus(),
          );
        }}
      >
        Change
      </button>
    </div>
  ) : (
    <div
      className="invoice-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <Field
        id={`${id}-input`}
        label="Link account (optional)"
        aria-label="Find billing customer"
        placeholder="Search name or email"
        error={error}
        maxLength={100}
        value={search}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          open && active >= 0 && items[active] ? `${id}-${active}` : undefined
        }
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((current) =>
              items.length
                ? event.key === "ArrowDown"
                  ? Math.min(current + 1, items.length - 1)
                  : current < 0
                    ? items.length - 1
                    : Math.max(0, current - 1)
                : -1,
            );
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (items[active]) choose(items[active]);
          }
        }}
      />
      {open && (
        <>
          {query.isFetching ? (
            <p role="status">Finding accounts…</p>
          ) : query.isError ? (
            <div>
              <p role="alert">Could not load customer accounts.</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void query.refetch()}
              >
                Retry accounts
              </Button>
            </div>
          ) : !items.length ? (
            <p>No matching accounts.</p>
          ) : (
            <p className="hint">Up to 20 matching accounts</p>
          )}
          <ul
            id={`${id}-options`}
            role="listbox"
            aria-label="Customer accounts"
          >
            {!query.isFetching &&
              !query.isError &&
              items.map((customer, index) => (
                <li
                  role="option"
                  id={`${id}-${index}`}
                  key={customer.id}
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(customer)}
                >
                  <strong>{customer.name}</strong>
                  <span>{customer.email}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}

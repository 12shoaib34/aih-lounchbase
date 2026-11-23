import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
export function SelectField({
  label,
  id: suppliedId,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const description =
    [describedBy, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : invalid}
        aria-describedby={description}
      >
        {children}
      </select>
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

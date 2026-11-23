import {
  useId,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
export function TextAreaField({
  label,
  labelAction,
  error,
  autoGrow = false,
  id: suppliedId,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  labelAction?: ReactNode;
  error?: string;
  autoGrow?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!autoGrow || !textarea.current) return;
    const element = textarea.current;
    const resize = () => {
      element.style.height = "auto";
      const style = getComputedStyle(element);
      element.style.height = `${element.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)}px`;
    };
    resize();
    let previousWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== previousWidth) {
        previousWidth = element.clientWidth;
        resize();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoGrow, props.value]);
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const description =
    [describedBy, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      {labelAction ? (
        <div className="field-label-row">
          <label htmlFor={id}>{label}</label>
          {labelAction}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <textarea
        {...props}
        ref={textarea}
        data-autogrow={autoGrow || undefined}
        id={id}
        aria-invalid={error ? true : invalid}
        aria-describedby={description}
      />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

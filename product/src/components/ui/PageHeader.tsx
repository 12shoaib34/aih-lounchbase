import { useContext, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { WorkspaceBreadcrumbContext } from "../layouts/WorkspaceBreadcrumbContext";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  headingRef,
}: {
  title: string;
  description?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const slot = useContext(WorkspaceBreadcrumbContext);
  return (
    <header className="portal-page-header page-header">
      <div className="page-header-row">
        <div className="page-header-copy">
          <h1 ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          {breadcrumbs &&
            (slot ? (
              slot.target && createPortal(breadcrumbs, slot.target)
            ) : (
              <div className="page-header-trail">{breadcrumbs}</div>
            ))}
          {description && (
            <p className="page-header-description">{description}</p>
          )}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}

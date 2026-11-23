import { useEffect, useState } from "react";

export type LoadingLayout = "list" | "form" | "overview" | "inline";

export function PageLoading({
  label = "Loading…",
  title = "",
  layout = loadingLayout(title),
}: {
  label?: string;
  title?: string;
  layout?: LoadingLayout;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section
      className={`page-loading page-loading-${layout}`}
      aria-busy="true"
      aria-label={label}
    >
      <span role="status" className="sr-only">
        {label}
      </span>
      <div className="loading-shapes" aria-hidden="true">
        {layout === "inline" ? (
          <>
            <i />
            <i />
            <i />
          </>
        ) : layout === "form" ? (
          <>
            <div className="loading-form-heading">
              <i />
              <i />
            </div>
            <div className="loading-fields">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <i />
                  <b />
                </div>
              ))}
            </div>
            <div className="loading-notes">
              <i />
              <b />
            </div>
          </>
        ) : (
          <>
            {layout === "overview" ? (
              <div className="loading-cards">
                {[0, 1, 2].map((index) => (
                  <div key={index}>
                    <i />
                    <b />
                    <i />
                  </div>
                ))}
              </div>
            ) : (
              <div className="loading-toolbar">
                <i />
                <b />
              </div>
            )}
            <div className="loading-table">
              <div className="loading-table-header">
                <i />
                <i />
                <i />
              </div>
              {[0, 1, 2, 3, 4].map((index) => (
                <div className="loading-table-row" key={index}>
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="loading-caption" aria-hidden={!slow}>
        {slow ? "Taking longer than usual. Still loading…" : "Loading…"}
      </p>
    </section>
  );
}

function loadingLayout(title: string): LoadingLayout {
  if (title === "Overview") return "overview";
  if (
    [
      "Business settings",
      "New invoice",
      "Edit draft",
      "Invoice details",
      "Contact details",
    ].includes(title)
  )
    return "form";
  return "list";
}

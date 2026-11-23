import { Link, type LinkProps } from "@/navigation";

type Breadcrumb = {
  label: string;
  to?: string;
  onClick?: LinkProps["onClick"];
};

export function Breadcrumbs({ items }: { items: readonly Breadcrumb[] }) {
  return (
    <nav className="page-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {index > 0 && (
              <span className="breadcrumb-separator" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="m6 4 4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
            {item.to && index < items.length - 1 ? (
              <Link to={item.to} onClick={item.onClick}>
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

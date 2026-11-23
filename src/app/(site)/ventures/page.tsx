import Link from "next/link";
export const metadata = {
  title: "MVP Development for Equity | AppsInHours Ventures",
  description:
    "Learn how selected founders can build an MVP with AppsInHours for an equity stake, what costs are separate and what to include in a partnership application.",
  alternates: {
    canonical: "https://appsinhours.com/ventures",
  },
  openGraph: {
    title: "MVP Development for Equity | AppsInHours Ventures",
    description:
      "Learn how selected founders can build an MVP with AppsInHours for an equity stake, what costs are separate and what to include in a partnership application.",
    url: "https://appsinhours.com/ventures",
    images: ["https://appsinhours.com/appsinhours-social.png"],
  },
};
export default function Page() {
  return (
    <>

      <main id={"main"} className={"venture-main"} tabIndex={-1}>
        <div className={"wrap page-back-row"}>
          <Link className={"page-back"} href={"/"}>
            <span className={"page-back-icon"} aria-hidden={"true"}>
              <svg
                width={"16"}
                height={"16"}
                viewBox={"0 0 24 24"}
                fill={"none"}
              >
                <path
                  d={"M19 12H5m6-6-6 6 6 6"}
                  stroke={"currentColor"}
                  strokeWidth={"1.7"}
                  strokeLinecap={"round"}
                  strokeLinejoin={"round"}
                />
              </svg>
            </span>
            <span className={"page-back-label"}>Back</span>
          </Link>
        </div>
        <section className={"wrap venture-hero"}>
          <div className={"venture-hero-copy"}>
            <p className={"eyebrow"}>APPSINHOURS VENTURES</p>
            <h1>
              An agreed MVP.
              <br />A shared stake.
            </h1>
            <p data-copy={"ventures-v2-opening"}>
              For selected founders, we contribute development to an agreed
              first release in exchange for equity. There is no upfront
              development fee for that scope. External costs, ownership and our
              involvement after the build are agreed individually.
            </p>
            <Link
              className={"primary-link"}
              href={"/contact?engagement=venture#brief"}
            >
              Apply for an MVP partnership ↗
            </Link>
            <p className={"venture-condition"}>
              Applying does not guarantee acceptance or investment.
            </p>
          </div>
          <aside className={"venture-partnership"}>
            <p className={"eyebrow"}>THE PARTNERSHIP / FOUNDER + STUDIO</p>
            <svg
              className={"venture-orbits"}
              viewBox={"0 0 520 280"}
              aria-hidden={"true"}
            >
              <ellipse cx={"185"} cy={"140"} rx={"165"} ry={"112"} />
              <ellipse cx={"335"} cy={"140"} rx={"165"} ry={"112"} />
              <circle
                className={"venture-signal"}
                cx={"20"}
                cy={"140"}
                r={"4"}
              />
              <circle
                className={"venture-signal"}
                cx={"500"}
                cy={"140"}
                r={"4"}
              />
              <circle
                className={"venture-core"}
                cx={"260"}
                cy={"140"}
                r={"45"}
              />
              <text x={"260"} y={"136"}>
                ONE MVP
              </text>
              <text x={"260"} y={"155"}>
                A SHARED STAKE
              </text>
            </svg>
            <h2>
              Customer insight.
              <br />
              Technical expertise.
              <br />
              One agreed first release.
            </h2>
          </aside>
        </section>
        <section className={"wrap venture-section"}>
          <p className={"eyebrow"}>01 / THE CONTRIBUTION</p>
          <h2>
            Different strengths.
            <br />
            Shared commitment.
          </h2>
          <div className={"venture-columns"}>
            <div>
              <p className={"eyebrow"}>WHAT YOU BRING</p>
              <h3>Customer insight. Founder commitment.</h3>
              <ul className={"venture-checklist"}>
                <li>
                  A specific customer problem and insight into the people
                  experiencing it.
                </li>
                <li>
                  Evidence you can discuss, such as customer conversations,
                  pilots or early users.
                </li>
                <li>
                  Time to make decisions, review the work and build the
                  business.
                </li>
                <li>
                  A practical plan for reaching customers and covering external
                  costs.
                </li>
              </ul>
            </div>
            <article className={"venture-card"}>
              <p className={"eyebrow"}>WHAT WE CAN CONTRIBUTE</p>
              <h3>Development around an agreed first release.</h3>
              <p>
                We help choose the first features, build them and review the
                working product with you. We agree who handles release and
                support before work starts.
              </p>
              <Link href={"/#process"}>See how we deliver ↗</Link>
            </article>
          </div>
        </section>
        <section id={"evaluation"} className={"wrap venture-section"}>
          <p className={"eyebrow"}>02 / FROM INTRODUCTION TO AGREEMENT</p>
          <h2>How we evaluate a founder application.</h2>
          <ol className={"venture-steps"}>
            <li>
              <span className={"eyebrow"}>01</span>
              <div>
                <h3>Introduce the business</h3>
                <p>Explain the customer, problem, evidence and your role.</p>
              </div>
            </li>
            <li>
              <span className={"eyebrow"}>02</span>
              <div>
                <h3>Review the fit</h3>
                <p>
                  We review customer evidence, how you plan to reach buyers and
                  whether the MVP fits our engineering capacity.
                </p>
              </div>
            </li>
            <li>
              <span className={"eyebrow"}>03</span>
              <div>
                <h3>Define the MVP</h3>
                <p>
                  Agree journeys, features, exclusions, dependencies and
                  acceptance criteria.
                </p>
              </div>
            </li>
            <li>
              <span className={"eyebrow"}>04</span>
              <div>
                <h3>Record the commitments</h3>
                <p>
                  Agree equity, ownership, external costs and continuing
                  involvement before development begins.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section id={"partnership-terms"} className={"wrap venture-section"}>
          <p className={"eyebrow"}>03 / WHAT THE OFFER MEANS</p>
          <h2>Set the boundaries before the build.</h2>
          <div className={"venture-terms"}>
            <article>
              <h3>Equity is the consideration.</h3>
              <p>
                This is not a free build. There is no standard public equity
                percentage; terms depend on the business and contribution.
              </p>
            </article>
            <article>
              <h3>The scope has boundaries.</h3>
              <p>
                Additional features and maintenance require a separate
                agreement.
              </p>
            </article>
            <article>
              <h3>External costs remain.</h3>
              <p>
                Hosting, paid APIs, app-store accounts and marketing are not
                automatically included. Responsibility is agreed upfront.
              </p>
            </article>
            <article>
              <h3>Continuity is discussed early.</h3>
              <p>
                The agreement addresses completed and unfinished work, equity,
                ownership and handover if the partnership ends.
              </p>
            </article>
          </div>
        </section>
        <section className={"wrap venture-section venture-example"}>
          <div>
            <p className={"eyebrow"}>04 / A VENTURE EXAMPLE</p>
            <h2>SabiWorkers</h2>
          </div>
          <div>
            <p data-copy={"ventures-v2-example"}>
              SabiWorkers connects job posts with applications from workers in
              Nigeria. AppsInHours contributed development as a venture partner.
            </p>
            <Link href={"/work#sabiworkers"}>Read the project story ↗</Link>
          </div>
        </section>
        <section className={"wrap venture-section venture-faq"}>
          <p className={"eyebrow"}>05 / BEFORE APPLYING</p>
          <h2>Understand the partnership.</h2>
          <details open>
            <summary>Do you provide cash investment?</summary>
            <p>
              The offer is development expertise for equity. It does not promise
              cash, fundraising, revenue or commercial success.
            </p>
          </details>
          <details open>
            <summary>
              Do I need an incorporated company to introduce the idea?
            </summary>
            <p>
              You can introduce it first. A workable entity and ownership
              arrangement must be documented before development begins.
            </p>
          </details>
          <details open>
            <summary>Will you become our permanent technical team?</summary>
            <p>
              Continuing work and leadership are agreed separately; the MVP does
              not include unlimited maintenance or a permanent CTO role.
            </p>
          </details>
        </section>
        <section className={"wrap venture-ending"}>
          <p className={"eyebrow"}>START WITH WHAT YOU KNOW</p>
          <h2>Bring the customer problem and what you have learned.</h2>
          <p>
            Start with the customer, your evidence and the first useful version.
            Confidential financial documents are not needed for the first
            conversation.
          </p>
          <div className={"venture-actions"}>
            <Link
              className={"primary-link"}
              href={"/contact?engagement=venture#brief"}
            >
              Apply for an MVP partnership ↗
            </Link>
            <Link href={"/#pricing"}>Compare engagement options ↗</Link>
          </div>
        </section>
      </main>
    </>
  );
}

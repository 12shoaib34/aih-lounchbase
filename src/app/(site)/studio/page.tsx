import Link from "next/link";
export const metadata = {
  title: "How We Build and Review Software | AppsInHours Studio",
  description:
    "See how our studio tests a product idea, reviews working software with your team and prepares a release, from the first user journey to handover.",
  alternates: {
    canonical: "https://appsinhours.com/studio",
  },
  openGraph: {
    title: "How We Build and Review Software | AppsInHours Studio",
    description:
      "See how our studio tests a product idea, reviews working software with your team and prepares a release, from the first user journey to handover.",
    url: "https://appsinhours.com/studio",
    images: ["https://appsinhours.com/appsinhours-social.png"],
  },
};
export default function Page() {
  return (
    <>

      <main id={"main"} className={"studio-main"} tabIndex={-1}>
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
        <section className={"wrap studio-hero"}>
          <div className={"studio-hero-copy"}>
            <p className={"eyebrow"}>APPSINHOURS / THE STUDIO</p>
            <h1>
              A clear path
              <br />
              from scope
              <br />
              to handover.
            </h1>
            <p data-copy={"studio-v2-opening"}>
              We start with a task your users need to complete. You can try
              working features as we build them and review how they handle
              errors before release.
            </p>
            <Link className={"primary-link"} href={"/#contact"}>
              Discuss your delivery needs ↗
            </Link>
          </div>
          <aside className={"studio-art"}>
            <p className={"eyebrow"}>SCOPE / REVIEW / RELEASE</p>
            <h2>
              A plan you can understand.
              <br />
              Progress you can review.
            </h2>
            <div className={"studio-gates"}>
              <div className={"studio-gate"}>
                <p className={"eyebrow"}>01 / DEFINE</p>
                <h3>Agree the first useful outcome.</h3>
              </div>
              <div className={"studio-connector"} aria-hidden={"true"}>
                <i />
              </div>
              <div className={"studio-gate"}>
                <p className={"eyebrow"}>02 / BUILD + REVIEW</p>
                <h3>Review working milestones.</h3>
              </div>
              <div className={"studio-connector"} aria-hidden={"true"}>
                <i />
              </div>
              <div className={"studio-gate"}>
                <p className={"eyebrow"}>03 / HAND OVER</p>
                <h3>Know what comes next.</h3>
              </div>
            </div>
          </aside>
        </section>
        <section id={"process"} className={"wrap studio-section"}>
          <div className={"studio-heading"}>
            <p className={"eyebrow"}>THE DELIVERY PROCESS</p>
            <h2>How we take a feature from idea to release.</h2>
          </div>
          <div className={"studio-delivery"}>
            <nav className={"studio-stage-nav"} aria-label={"Delivery stages"}>
              <a href={"#delivery-1"}>
                <span>01</span>Understand
              </a>
              <a href={"#delivery-2"}>
                <span>02</span>Scope
              </a>
              <a href={"#delivery-3"}>
                <span>03</span>Prototype
              </a>
              <a href={"#delivery-4"}>
                <span>04</span>Build
              </a>
              <a href={"#delivery-5"}>
                <span>05</span>Check
              </a>
              <a href={"#delivery-6"}>
                <span>06</span>Handover
              </a>
            </nav>
            <ol className={"studio-steps"}>
              <li id={"delivery-1"}>
                <span className={"eyebrow"}>01</span>
                <div>
                  <h3>Understand the work</h3>
                  <p>
                    Tell us who needs the product, what they need to accomplish
                    and what is getting in the way. We discuss the existing
                    systems, budget constraints and decisions that may affect
                    the build.
                  </p>
                </div>
              </li>
              <li id={"delivery-2"}>
                <span className={"eyebrow"}>02</span>
                <div>
                  <h3>Agree the scope</h3>
                  <p>
                    Define the essential journey, deliverables, exclusions and
                    dependencies. Agree what needs to be true for a milestone to
                    be accepted, who reviews it and what decisions the client
                    needs to make.
                  </p>
                  <p className={"studio-output"}>
                    What you review: the proposed scope, responsibilities,
                    review points and commercial terms.
                  </p>
                </div>
              </li>
              <li id={"delivery-3"}>
                <span className={"eyebrow"}>03</span>
                <div>
                  <h3>Make the journey tangible</h3>
                  <p>
                    Review the key screens and behaviour before committing to
                    all the implementation details. Where a prototype is part of
                    the engagement, use it to resolve important questions early.
                  </p>
                  <p className={"studio-output"}>
                    What you review: the agreed design direction and, where
                    scoped, a prototype.
                  </p>
                </div>
              </li>
              <li id={"delivery-4"}>
                <span className={"eyebrow"}>04</span>
                <div>
                  <h3>Review working features</h3>
                  <p>
                    Review working progress against the agreed scope. Updates
                    explain completed work, upcoming priorities, blockers and
                    decisions needed from your team. New requirements are
                    assessed for their effect on cost and timing before
                    additional work proceeds.
                  </p>
                  <p className={"studio-output"}>
                    What you review: working features, progress updates and any
                    proposed scope changes.
                  </p>
                </div>
              </li>
              <li id={"delivery-5"}>
                <span className={"eyebrow"}>05</span>
                <div>
                  <h3>Check the release</h3>
                  <p>
                    Review the work against agreed acceptance criteria and
                    testing responsibilities. Resolve release-blocking issues
                    and identify any known limitations before the agreed release
                    approval.
                  </p>
                  <p className={"studio-output"}>
                    Before release, we identify blocking issues, record known
                    limitations and agree who will deploy.
                  </p>
                </div>
              </li>
              <li id={"delivery-6"}>
                <span className={"eyebrow"}>06</span>
                <div>
                  <h3>Hand over and plan the next step</h3>
                  <p>
                    Clarify source access, setup instructions, service accounts
                    and support responsibilities. Improvements after launch can
                    be scoped separately around what users and your team need
                    next.
                  </p>
                  <p className={"studio-output"}>
                    What you receive: the access, documentation and handover
                    agreed in your project scope.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <section className={"wrap studio-section studio-split"}>
          <div>
            <p className={"eyebrow"}>A REVIEWABLE MILESTONE</p>
            <h2>Make “done” specific enough to review.</h2>
            <p>
              Acceptance criteria turn an idea into behaviour you can check
              together.
            </p>
          </div>
          <article className={"studio-example-card"}>
            <p className={"eyebrow"}>ILLUSTRATIVE BOOKING EXAMPLE</p>
            <h3>From available time to confirmed request.</h3>
            <p>
              A customer selects a service and an available time. Your operator
              can find the confirmed request and see what needs to happen next.
            </p>
            <ul className={"studio-checklist"}>
              <li>
                Required information is checked before the booking is accepted.
              </li>
              <li>An unavailable time cannot be confirmed.</li>
              <li>A successful booking appears in the operator’s view.</li>
              <li>
                If confirmation fails, the customer sees a useful next step.
              </li>
            </ul>
            <p>
              Payments, reminders and cancellation rules would be separate
              decisions unless included in the agreed scope. Your project’s
              acceptance criteria will reflect its actual workflow.
            </p>
          </article>
        </section>
        <section id={"studio"} className={"wrap studio-section"}>
          <p className={"eyebrow"}>CLEAR RESPONSIBILITIES</p>
          <h2>Good collaboration starts with clarity.</h2>
          <div className={"studio-cards"}>
            <article>
              <h3>Your delivery contacts</h3>
              <p>
                Your proposal identifies who is responsible for implementation
                and coordination, the capacity agreed for the work and how
                progress will be reviewed.
              </p>
            </article>
            <article>
              <h3>Your team’s contribution</h3>
              <p>
                Provide the business rules, access and feedback needed for the
                agreed milestones. Flag changing requirements early so their
                impact can be assessed.
              </p>
            </article>
            <article>
              <h3>Your existing workflow</h3>
              <p>
                When we join your team, we work with your code review and
                deployment process. We’re developing Launchbase to reuse common
                engineering patterns. Applications built from that foundation
                are designed to have their own codebase, configuration, database
                and deployment.
              </p>
            </article>
          </div>
        </section>
        <section className={"wrap studio-section studio-faq"}>
          <p className={"eyebrow"}>BEFORE YOU COMMIT</p>
          <h2>Agree the boundaries early.</h2>
          <details open>
            <summary>How are changes handled?</summary>
            <p>
              We discuss their effect on deliverables, cost and timing before
              additional work proceeds.
            </p>
          </details>
          <details open>
            <summary>Who owns the code and service accounts?</summary>
            <p>
              Ownership, third-party licences, account responsibilities and
              handover are agreed in the contract. We recommend keeping your
              domain and production service accounts under your control.
            </p>
          </details>
          <details open>
            <summary>What support is included?</summary>
            <p>
              Support and maintenance are included only where specified. Agree
              the scope and responsibilities before launch; additional
              improvements can be planned separately.
            </p>
          </details>
        </section>
        <section className={"wrap studio-section studio-ending"}>
          <p className={"eyebrow"}>YOUR FIRST MILESTONE</p>
          <h2>What should your first release do?</h2>
          <p data-copy={"studio-v2-close"}>
            Share the product, the people using it and the outcome you want to
            reach. We will discuss what needs to be decided before building
            begins.
          </p>
          <div className={"studio-actions"}>
            <Link className={"primary-link"} href={"/#contact"}>
              Discuss your project ↗
            </Link>
            <Link href={"/#pricing"}>Compare engagement options ↗</Link>
          </div>
        </section>
      </main>
    </>
  );
}

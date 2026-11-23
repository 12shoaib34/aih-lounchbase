import Link from "next/link";
export const metadata = {
  title:
    "Project Builds, Engineering Support & Equity Partnerships | AppsInHours",
  description:
    "Compare a paid software build, ongoing engineering support and a selective development-for-equity partnership for your first release.",
  alternates: {
    canonical: "https://appsinhours.com/engagements",
  },
  openGraph: {
    title:
      "Project Builds, Engineering Support & Equity Partnerships | AppsInHours",
    description:
      "Compare a paid software build, ongoing engineering support and a selective development-for-equity partnership for your first release.",
    url: "https://appsinhours.com/engagements",
    images: ["https://appsinhours.com/appsinhours-social.png"],
  },
};
export default function Page() {
  return (
    <>

      <main id={"main"} className={"detail-main"} tabIndex={-1}>
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
        <section
          id={"engagement"}
          className={"wrap content-opening detail-hero"}
        >
          <div className={"detail-hero-copy"}>
            <p className={"eyebrow"}>WORK WITH US</p>
            <h1>Choose how to work with us.</h1>
            <p data-copy={"engagements-v2-opening"}>
              Commission a defined build, reserve engineering time for your
              roadmap or apply to build an MVP in exchange for equity. The first
              two are paid engagements. Ventures reviews each founder
              application individually.
            </p>
            <Link className={"primary-link"} href={"/contact"}>
              Discuss your project ↗
            </Link>
          </div>
          <aside className={"detail-art engagement-paths"}>
            <p className={"eyebrow"}>FIND YOUR STARTING POINT</p>
            <a href={"#project-delivery"} className={"engagement-path"}>
              <span>01</span>
              <div>
                <strong>A defined outcome</strong>
                <small>Project delivery</small>
              </div>
              <b aria-hidden={"true"}>↓</b>
            </a>
            <a href={"#team-extension"} className={"engagement-path"}>
              <span>02</span>
              <div>
                <strong>Your existing roadmap</strong>
                <small>Team extension</small>
              </div>
              <b aria-hidden={"true"}>↓</b>
            </a>
            <a href={"#venture-partnership"} className={"engagement-path"}>
              <span>03</span>
              <div>
                <strong>A shared stake</strong>
                <small>Venture partnership</small>
              </div>
              <b aria-hidden={"true"}>↓</b>
            </a>
          </aside>
        </section>
        <section className={"wrap content-block"}>
          <p className={"eyebrow"}>THREE WAYS TO WORK TOGETHER</p>
          <h2>Match the engagement to the work.</h2>
          <div className={"content-cards"}>
            <article id={"project-delivery"}>
              <p className={"eyebrow"}>01 / A DEFINED OUTCOME</p>
              <h3>Project delivery</h3>
              <p>
                Choose this for a specific feature or product release. We quote
                for the agreed work. If it needs investigation first, we discuss
                that cost separately.
              </p>
              <Link href={"/contact?service=Build%20a%20product#brief"}>
                Discuss project delivery ↗
              </Link>
            </article>
            <article id={"team-extension"}>
              <p className={"eyebrow"}>02 / YOUR EXISTING ROADMAP</p>
              <h3>Team extension</h3>
              <p>
                Choose this when your team sets the priorities and needs
                engineering time. Agree hourly or weekly capacity, working hours
                and updates before starting. You approve any additional hours.
              </p>
              <Link href={"/contact?engagement=team#brief"}>
                Discuss team capacity ↗
              </Link>
            </article>
            <article id={"venture-partnership"}>
              <p className={"eyebrow"}>03 / A SHARED STAKE</p>
              <h3>Venture partnership</h3>
              <p>
                Development of an agreed MVP in exchange for equity for selected
                founders. External costs and continuing involvement are agreed
                separately.
              </p>
              <Link href={"/ventures"}>Explore venture terms ↗</Link>
            </article>
          </div>
        </section>
        <section id={"starter-packages"} className={"wrap content-block"}>
          <p className={"eyebrow"}>STARTING POINTS TO DISCUSS</p>
          <h2>Start with a focused scope.</h2>
          <p>
            Your proposal sets out what’s included, what we need from you and
            how you’ll review the work.
          </p>
          <div className={"scope-options"}>
            <article>
              <h3>Shape a first release</h3>
              <p>
                Discuss the essential journey, open questions and acceptance
                criteria. A prototype can be included where agreed.
              </p>
              <Link href={"/contact?serviceArea=scoping#brief"}>
                Discuss product scope ↗
              </Link>
            </article>
            <article>
              <h3>Build a business website</h3>
              <p>
                Discuss the pages, approved content, enquiry flow and whether
                editable content is needed. Agree the page count and
                integrations in the proposal.
              </p>
              <Link href={"/contact?projectType=website#brief"}>
                Discuss a website ↗
              </Link>
            </article>
            <article>
              <h3>Validate a web workflow</h3>
              <p>
                Start with one useful customer journey. Discuss user roles, data
                and required integrations before agreeing the first release.
              </p>
              <Link href={"/contact?projectType=saas#brief"}>
                Discuss a web MVP ↗
              </Link>
            </article>
            <article>
              <h3>Improve an existing product</h3>
              <p>
                Bring a feature or reproducible issue. An initial review helps
                establish feasibility, dependencies and the scope of a change.
              </p>
              <Link
                href={
                  "/contact?service=Improve%20an%20existing%20product&serviceArea=improvement#brief"
                }
              >
                Discuss an improvement ↗
              </Link>
            </article>
          </div>
          <p>
            Each starting point receives a scoped proposal. Deliverables, timing
            and commercial terms are agreed for your project.
          </p>
        </section>
        <section className={"wrap content-block content-questions"}>
          <p className={"eyebrow"}>BEFORE WORK BEGINS</p>
          <h2>Know what your proposal covers.</h2>
          <details>
            <summary>Price and timing</summary>
            <p>
              Request a scoped quote. We estimate the work after confirming
              scope, required access and available capacity. Client feedback and
              third-party dependencies affect the schedule.
            </p>
          </details>
          <details>
            <summary>Changes and revisions</summary>
            <p>
              The proposal states review rounds and included changes. Additional
              requests are assessed before work proceeds.
            </p>
          </details>
          <details>
            <summary>External costs</summary>
            <p>
              Hosting, paid APIs, app-store accounts and other external services
              are included only where explicitly specified.
            </p>
          </details>
          <details>
            <summary>Ownership and handover</summary>
            <p>
              Source access, third-party licences, account ownership and
              handover responsibilities are agreed in the contract.
            </p>
          </details>
          <details>
            <summary>Support after release</summary>
            <p>
              The proposal identifies any included support, its duration and
              boundaries. Continuing improvements are scoped separately.
            </p>
          </details>
        </section>
        <section className={"wrap content-block content-ending"}>
          <p className={"eyebrow"}>YOUR NEXT STEP</p>
          <h2>Not sure which starting point fits?</h2>
          <p>
            Describe the goal, the current product and the constraints. We will
            discuss an engagement that matches the work.
          </p>
          <Link className={"primary-link"} href={"/contact"}>
            Discuss your project ↗
          </Link>
        </section>
      </main>
    </>
  );
}

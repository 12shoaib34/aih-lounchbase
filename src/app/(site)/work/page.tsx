import WorkConcepts from "../../../site/work-concepts";
import Link from "next/link";
export const metadata = {
  title: "FoodChoo, PakGo & SabiWorkers | AppsInHours Work",
  description:
    "Explore FoodChoo, an end-to-end food delivery app build, PakGo’s freight booking tools and the SabiWorkers venture partnership.",
  alternates: {
    canonical: "https://appsinhours.com/work",
  },
  openGraph: {
    title: "FoodChoo, PakGo & SabiWorkers | AppsInHours Work",
    description:
      "Explore FoodChoo, an end-to-end food delivery app build, PakGo’s freight booking tools and the SabiWorkers venture partnership.",
    url: "https://appsinhours.com/work",
    images: ["https://appsinhours.com/appsinhours-social.png"],
  },
};
export default function Page() {
  return (
    <>

      <main id={"main"} className={"work-main"} tabIndex={-1}>
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
        <section id={"work"} className={"wrap work-opening"}>
          <p className={"eyebrow"}>SELECTED WORK</p>
          <p className={"work-opening-title"}>
            The product, the problem and our part in building it.
          </p>
          <p data-copy={"work-v2-opening"}>
            Explore FoodChoo, PakGo and the SabiWorkers venture partnership,
            followed by two interface concepts.
          </p>
        </section>
        <section
          id={"sabiworkers"}
          className={"wrap work-hero"}
          aria-labelledby={"sabi-title"}
        >
          <div className={"work-hero-copy"}>
            <h1 id={"sabi-title"}>SabiWorkers.</h1>
            <p className={"work-lead"}>
              A marketplace for blue-collar jobs in Nigeria.
            </p>
            <p data-copy={"work-v2-intro"}>
              Clients post a job. Nearby workers can apply.
            </p>
            <div className={"work-actions"}>
              <a className={"primary-link"} href={"#product-journey"}>
                Explore the product journey ↓
              </a>
              <a href={"https://www.sabiworkers.com/"}>Visit SabiWorkers ↗</a>
            </div>
          </div>
          <aside className={"work-art"}>
            <h2 className={"eyebrow"}>THE CONNECTION / ONE SHARED JOURNEY</h2>
            <div className={"work-gates"}>
              <div className={"work-gate"}>
                <p className={"eyebrow"}>CLIENT</p>
                <h3>Describe the work.</h3>
                <p>A job that needs the right skills.</p>
              </div>
              <div className={"work-connector"} aria-hidden={"true"}>
                <i />
              </div>
              <div className={"work-gate"}>
                <p className={"eyebrow"}>OPPORTUNITY</p>
                <h3>Find work nearby.</h3>
                <p>A place for clients and workers to connect.</p>
              </div>
              <div className={"work-connector"} aria-hidden={"true"}>
                <i />
              </div>
              <div className={"work-gate"}>
                <p className={"eyebrow"}>WORKER</p>
                <h3>Apply for the opportunity.</h3>
                <p>Show what you do.</p>
              </div>
            </div>
            <p className={"work-art-note"}>
              Illustrative journey, not a product screenshot.
            </p>
          </aside>
        </section>
        <div className={"wrap"}>
          <dl className={"work-facts"}>
            <div>
              <dt>Product</dt>
              <dd>Hiring marketplace</dd>
            </div>
            <div>
              <dt>Market</dt>
              <dd>Nigeria</dd>
            </div>
            <div>
              <dt>Our contribution</dt>
              <dd>Product development</dd>
            </div>
            <div>
              <dt>Engagement</dt>
              <dd>Venture partnership</dd>
            </div>
          </dl>
        </div>
        <section className={"wrap work-section"}>
          <p className={"eyebrow"}>01 / THE PROBLEM</p>
          <h2>
            Two sides.
            <br />
            One shared hiring journey.
          </h2>
          <div className={"work-cards"}>
            <article>
              <h3>The problem</h3>
              <p>
                Clients need people with the right skills close to the job.
                Workers need to know when those jobs open up.
              </p>
            </article>
            <article>
              <h3>Our contribution</h3>
              <p>
                AppsInHours contributed software development as a venture
                partner.
              </p>
            </article>
          </div>
        </section>
        <section id={"product-journey"} className={"wrap work-section"}>
          <p className={"eyebrow"}>02 / THE PRODUCT JOURNEY</p>
          <h2>
            From a job post
            <br />
            to an application.
          </h2>
          <p>
            An illustrative walkthrough of the hiring journey, not a product
            screenshot.
          </p>
          <ol className={"work-steps"}>
            <li>
              <span className={"work-number"}>01</span>
              <div>
                <h3>Describe the job.</h3>
                <p>A client describes the job they need help with.</p>
                <span className={"work-progress"} aria-hidden={"true"} />
              </div>
            </li>
            <li>
              <span className={"work-number"}>02</span>
              <div>
                <h3>Find an opportunity nearby.</h3>
                <p>
                  A worker finds an opportunity nearby and can show what they
                  do.
                </p>
                <span className={"work-progress"} aria-hidden={"true"} />
              </div>
            </li>
            <li>
              <span className={"work-number"}>03</span>
              <div>
                <h3>Apply for the opportunity.</h3>
                <p>The worker applies for the opportunity.</p>
                <span className={"work-progress"} aria-hidden={"true"} />
              </div>
            </li>
          </ol>
        </section>
        <section className={"wrap work-partnership"}>
          <p className={"eyebrow"}>03 / THE PARTNERSHIP</p>
          <h2>
            Development as
            <br />a venture partner.
          </h2>
          <p>
            We contributed development as a venture partner. For the agreed
            build, the founding team paid no upfront development fee. Our
            venture model exchanges development of an agreed MVP for equity,
            with scope and continuing involvement agreed individually.
          </p>
          <div className={"work-actions"}>
            <Link className={"primary-link"} href={"/ventures"}>
              Explore venture partnerships ↗
            </Link>
            <Link href={"/?projectType=marketplace#contact"}>
              Discuss a marketplace project ↗
            </Link>
          </div>
        </section>
        <section
          id={"delivery-platforms"}
          className={"wrap work-section"}
          aria-labelledby={"delivery-title"}
        >
          <h2 id={"delivery-title"}>Food delivery and freight.</h2>
          <div className={"work-cards"}>
            <article id={"foodchoo"}>
              <h3>FoodChoo</h3>
              <p>
                We built FoodChoo end to end. Its mobile app lets customers
                order food for on-demand delivery.
              </p>
            </article>
            <article id={"pakgo"}>
              <h3>PakGo</h3>
              <p>
                Shippers book and track freight, carriers assign loads to
                trucks, and drivers record pickups and deliveries.
              </p>
              <div className={"work-actions"}>
                <a href={"https://pakgo.org/"}>Visit PakGo ↗</a>
              </div>
            </article>
          </div>
        </section>
        <section className={"wrap work-section"}>
          <p className={"eyebrow"}>04 / DESIGN EXPLORATIONS</p>
          <h2>Two interface concepts.</h2>
          <p>
            Two original studio concepts explore restaurant ordering on the web
            and daily progress tracking on mobile.
          </p>
          <WorkConcepts />
          <noscript>
            <p>
              These previews are illustrative interface concepts. JavaScript
              enables the expanded concept descriptions.
            </p>
          </noscript>
        </section>
        <section className={"wrap work-ending"}>
          <p className={"eyebrow"}>YOUR PRODUCT JOURNEY</p>
          <h2>
            What journey does your
            <br className={"work-desktop-break"} /> product need to support?
          </h2>
          <p>
            Tell us who will use it, what they need to do and where you need
            development support. We can discuss a scoped build, an improvement
            to an existing product or capacity for your team.
          </p>
          <div className={"work-actions"}>
            <Link className={"primary-link"} href={"/#contact"}>
              Discuss your project ↗
            </Link>
            <Link href={"/services"}>Explore services and project types ↗</Link>
          </div>
        </section>
      </main>


    </>
  );
}

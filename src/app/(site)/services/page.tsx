import Link from "next/link";
export const metadata = {
  title: "MVP Development, Web & Mobile Engineering | AppsInHours",
  description:
    "Commission a paid MVP, custom web or mobile application, or SaaS product. Explore backend integrations and engineering support for your existing software.",
  alternates: {
    canonical: "https://appsinhours.com/services",
  },
  openGraph: {
    title: "MVP Development, Web & Mobile Engineering | AppsInHours",
    description:
      "Commission a paid MVP, custom web or mobile application, or SaaS product. Explore backend integrations and engineering support for your existing software.",
    url: "https://appsinhours.com/services",
    images: ["https://appsinhours.com/appsinhours-social.png"],
  },
};
export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            '{"@context":"https://schema.org","@graph":[{"@type":"Service","@id":"https://appsinhours.com/services#service-scoping","name":"Product scoping and prototyping","provider":{"@id":"https://appsinhours.com/#organization"}},{"@type":"Service","@id":"https://appsinhours.com/services#service-web","name":"Web application development","provider":{"@id":"https://appsinhours.com/#organization"}},{"@type":"Service","@id":"https://appsinhours.com/services#service-mobile","name":"Mobile application development","provider":{"@id":"https://appsinhours.com/#organization"}},{"@type":"Service","@id":"https://appsinhours.com/services#service-backend","name":"Backend and integrations","provider":{"@id":"https://appsinhours.com/#organization"}},{"@type":"Service","@id":"https://appsinhours.com/services#service-improvement","name":"Product improvement and team extension","provider":{"@id":"https://appsinhours.com/#organization"}}]}',
        }}
      />

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
        <section id={"services"} className={"wrap content-opening detail-hero"}>
          <div className={"detail-hero-copy"}>
            <p className={"eyebrow"}>SERVICES</p>
            <h1>MVP development and custom software.</h1>
            <p data-copy={"services-v2-opening"}>
              Commission a paid MVP to test one essential workflow with early
              users. We also build web and mobile applications, connect business
              systems and support existing products.
            </p>
            <div className={"content-actions"}>
              <Link className={"primary-link"} href={"/contact"}>
                Discuss your project ↗
              </Link>
              <Link href={"/engagements"}>Compare engagement options ↗</Link>
            </div>
          </div>
          <aside
            className={"detail-art"}
            aria-label={"From product scope to a connected experience"}
          >
            <p className={"eyebrow"}>ONE PRODUCT / CONNECTED PARTS</p>
            <div className={"system-map"} aria-hidden={"true"}>
              <div className={"system-core"}>
                <span>YOUR NEXT</span>
                <strong>Useful milestone.</strong>
              </div>
              <div className={"system-branches"}>
                <i />
                <i />
                <i />
                <b className={"system-dot"} />
              </div>
              <div className={"system-nodes"}>
                <span>Interface</span>
                <span>Logic</span>
                <span>Data</span>
              </div>
            </div>
          </aside>
        </section>
        <section className={"wrap content-block"}>
          <p className={"eyebrow"}>OUR SERVICES</p>
          <h2>Engineering services for your product.</h2>
          <div className={"service-catalogue"}>
            <article id={"service-scoping"}>
              <p className={"eyebrow"}>01 / SERVICE</p>
              <h3>Product scoping and prototyping</h3>
              <p>
                Work out what a user should be able to do in the first release.
                Where useful, test that flow with a prototype before investing
                in development.
              </p>
              <p className={"service-discuss"}>
                Discuss: user journeys, release scope and reviewable design
                direction.
              </p>
              <Link href={"/contact?serviceArea=scoping#brief"}>
                Discuss this service ↗
              </Link>
            </article>
            <article id={"service-web"}>
              <p className={"eyebrow"}>02 / SERVICE</p>
              <h3>Web application development</h3>
              <p>
                Build browser-based experiences for customers and the people
                running your business. Connect the interface with the data,
                permissions and workflows it needs.
              </p>
              <p className={"service-discuss"}>
                Discuss: web applications, SaaS interfaces and customer or staff
                portals.
              </p>
              <Link href={"/contact?serviceArea=web#brief"}>
                Discuss this service ↗
              </Link>
            </article>
            <article id={"service-mobile"}>
              <p className={"eyebrow"}>03 / SERVICE</p>
              <h3>Mobile application development</h3>
              <p>
                Create iOS and Android journeys around the way your users work.
                Choose native development or a shared React Native codebase
                according to platform requirements and the agreed scope.
              </p>
              <p className={"service-discuss"}>
                Discuss: onboarding, device integrations and connected mobile
                workflows.
              </p>
              <Link href={"/contact?serviceArea=mobile#brief"}>
                Discuss this service ↗
              </Link>
            </article>
            <article id={"service-backend"}>
              <p className={"eyebrow"}>04 / SERVICE</p>
              <h3>Backend and integrations</h3>
              <p>
                Connect your interfaces to business rules and the systems behind
                them. We scope APIs, account access, data flows and integrations
                around the product's requirements.
              </p>
              <p className={"service-discuss"}>
                Discuss: Node.js APIs, authentication, business logic and
                third-party connections.
              </p>
              <Link href={"/contact?serviceArea=backend#brief"}>
                Discuss this service ↗
              </Link>
            </article>
            <article id={"service-improvement"}>
              <p className={"eyebrow"}>05 / SERVICE</p>
              <h3>Product improvement and team extension</h3>
              <p>
                Move an existing product forward with a bounded feature,
                integration or fix. If your team already owns the roadmap,
                discuss development capacity within your workflow.
              </p>
              <p className={"service-discuss"}>
                Discuss: codebase review, scoped improvements and agreed hourly
                or weekly support.
              </p>
              <Link href={"/contact?serviceArea=improvement#brief"}>
                Discuss this service ↗
              </Link>
            </article>
          </div>
        </section>
        <section id={"solutions"} className={"wrap content-block"}>
          <p className={"eyebrow"}>PROJECT TYPES</p>
          <h2>What are you trying to build?</h2>
          <p>
            These examples help frame the conversation. Features, integrations
            and delivery commitments are agreed for your project.
          </p>
          <div className={"project-catalogue"}>
            <article id={"project-website"}>
              <h3>Business website</h3>
              <p>Present your services, work and a clear route to enquiry.</p>
              <details>
                <summary>What to consider</summary>
                <p>
                  Do you need editable content, migration or ongoing updates?
                </p>
              </details>
              <Link href={"/contact?projectType=website#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
            <article id={"project-saas"}>
              <h3>SaaS MVP</h3>
              <p>Let an initial group of users complete one useful workflow.</p>
              <details>
                <summary>What to consider</summary>
                <p>
                  Are subscriptions, multiple organisations or reporting
                  required?
                </p>
              </details>
              <Link href={"/contact?projectType=saas#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
            <article id={"solution-commerce"}>
              <h3>Commerce and ordering</h3>
              <p>Connect discovery and checkout with order management.</p>
              <details>
                <summary>What to consider</summary>
                <p>
                  Which payment, inventory and fulfilment systems are involved?
                </p>
              </details>
              <Link href={"/contact?projectType=commerce#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
            <article id={"solution-bookings"}>
              <h3>Booking and scheduling</h3>
              <p>
                Bring service availability, reservations and staff workflows
                together.
              </p>
              <details>
                <summary>What to consider</summary>
                <p>
                  What rules apply to time zones, cancellations and payment?
                </p>
              </details>
              <Link href={"/contact?projectType=bookings#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
            <article id={"project-marketplace"}>
              <h3>Marketplace</h3>
              <p>Connect people offering something with people who need it.</p>
              <details>
                <summary>What to consider</summary>
                <p>
                  Does the journey require applications, transactions, payouts
                  or moderation?
                </p>
              </details>
              <Link href={"/contact?projectType=marketplace#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
            <article id={"solution-operations"}>
              <h3>Customer or staff portal</h3>
              <p>Give requests, responsibilities and status a shared home.</p>
              <details>
                <summary>What to consider</summary>
                <p>
                  Who can see or change each record, and which systems supply
                  the data?
                </p>
              </details>
              <Link href={"/contact?projectType=portal#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
            <article id={"solution-connected-mobile"}>
              <h3>Mobile product</h3>
              <p>Put a defined journey on iOS, Android or both.</p>
              <details>
                <summary>What to consider</summary>
                <p>
                  Which device capabilities and backend connections are
                  essential?
                </p>
              </details>
              <Link href={"/contact?projectType=mobile#brief"}>
                Discuss this project type ↗
              </Link>
            </article>
          </div>
        </section>
        <section className={"wrap content-block content-split"}>
          <div>
            <p className={"eyebrow"}>TECHNICAL EXPERTISE</p>
            <h2>Which technology fits your product?</h2>
          </div>
          <div>
            <ul className={"expertise-chips"}>
              <li>iOS</li>
              <li>Android</li>
              <li>React.js</li>
              <li>Node.js</li>
              <li>React Native</li>
            </ul>
            <p>
              You do not need to arrive with a technology decision. We discuss
              the user journey, existing systems and platform constraints before
              agreeing the approach.
            </p>
            <Link href={"/studio"}>See how we deliver ↗</Link>
          </div>
        </section>
        <section className={"wrap content-block content-ending"}>
          <p className={"eyebrow"}>YOUR NEXT STEP</p>
          <h2>Start with the outcome you need.</h2>
          <p>
            Tell us what users need to do and what you already have. We’ll
            discuss which part to build or improve first.
          </p>
          <Link className={"primary-link"} href={"/contact#brief"}>
            Prepare your brief ↗
          </Link>
        </section>
      </main>
    </>
  );
}

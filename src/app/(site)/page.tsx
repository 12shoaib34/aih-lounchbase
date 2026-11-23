import Link from "next/link";
export const metadata = {
  title: "Custom Software, SaaS & MVP Development | AppsInHours",
  description:
    "AppsInHours builds web and mobile applications, SaaS products and business software. Selected founders can apply to build an MVP in exchange for equity.",
  alternates: {
    canonical: "https://appsinhours.com/",
  },
  openGraph: {
    title: "Custom Software, SaaS & MVP Development | AppsInHours",
    description:
      "AppsInHours builds web and mobile applications, SaaS products and business software. Selected founders can apply to build an MVP in exchange for equity.",
    url: "https://appsinhours.com/",
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
            '{"@context":"https://schema.org","@type":"Organization","@id":"https://appsinhours.com/#organization","name":"AppsInHours","url":"https://appsinhours.com/","logo":"https://appsinhours.com/site/brand-monogram-light.svg","email":"inquiry@appsinhours.com","description":"Software engineering studio building custom web applications, mobile applications, SaaS platforms and business software."}',
        }}
      />

      <main id={"main"} tabIndex={-1}>
        <section
          id={"home"}
          className={"op-hero"}
          aria-labelledby={"hero-title"}
        >
          <div className={"op-grid"} aria-hidden={"true"} />
          <div className={"wrap op-hero-inner"}>
            <div className={"op-hero-copy"}>
              <p className={"eyebrow"}>
                <span className={"op-status"} /> APPSINHOURS VENTURES / FOR
                FOUNDERS
              </p>
              <h1 id={"hero-title"}>
                <span className={"hero-reveal-line"}>
                  <span>We build</span>
                </span>{" "}
                <span className={"hero-reveal-line"}>
                  <span>your MVP</span>
                </span>{" "}
                <span className={"hero-reveal-line"}>
                  <span>for equity.</span>
                </span>
              </h1>
              <p className={"op-intro"}>
                We partner with selected founders to build the first version of
                their web or mobile app. You pay no upfront development fee.
                External costs like hosting are separate.
              </p>
              <div className={"op-actions"}>
                <a className={"primary-link"} href={"#ventures"}>
                  Explore the partnership <span aria-hidden={"true"}>↓</span>
                </a>
                <a
                  className={"op-text-link"}
                  href={"#contact"}
                  data-inquiry-service={"Build a product"}
                >
                  Discuss a paid MVP <span aria-hidden={"true"}>↗</span>
                </a>
              </div>
            </div>
            <div className={"op-sculpture"} aria-hidden={"true"}>
              <img
                className={"op-cloud-fallback"}
                src={"/site/cloud-brain.svg"}
                alt={""}
                width={"600"}
                height={"500"}
              />
              <div id={"op-canvas"} />
            </div>
            <div className={"op-hero-bottom"}>
              <Link
                className={"op-venture-discovery"}
                href={"/work#sabiworkers"}
              >
                <strong>See our venture work ↗</strong>
                <small>SABIWORKERS / NIGERIA</small>
              </Link>
              <a href={"#about"}>
                SCROLL TO EXPLORE <span>↓</span>
              </a>
              <span>WEB   /   MOBILE   /   SYSTEMS</span>
            </div>
          </div>
        </section>
        <section
          id={"about"}
          className={"op-section op-about wrap"}
          aria-labelledby={"about-title"}
        >
          <div className={"op-section-heading"}>
            <p className={"eyebrow"}>01 / A CLEARER WAY TO BUILD</p>
            <h2 id={"about-title"}>
              More clarity.
              <br />
              <em>At every step</em>
              <span className={"op-dot"}>.</span>
            </h2>
          </div>
          <div className={"op-about-grid"}>
            <div className={"op-about-sticky"}>
              <p className={"op-statement"}>
                Know what you are building, what you are agreeing to, and what
                happens next.
              </p>
              <p data-copy={"home-v2-opening"}>
                Bring us a new product idea, a feature your users need or
                engineering work your team needs help delivering.
              </p>
              <div className={"op-system"} aria-hidden={"true"}>
                <span>YOUR GOAL</span>
                <div className={"op-system-ring"}>
                  <i />
                  <b>
                    <span
                      className={"brand-art brand-icon"}
                      aria-hidden={"true"}
                    >
                      <img
                        className={"brand-on-dark"}
                        src={"/site/brand-monogram-dark.svg"}
                        alt={""}
                        width={"192"}
                        height={"192"}
                      />
                      <img
                        className={"brand-on-light"}
                        src={"/site/brand-monogram-light.svg"}
                        alt={""}
                        width={"192"}
                        height={"192"}
                      />
                      <img
                        className={"brand-on-print"}
                        src={"/site/brand-monogram-black.svg"}
                        alt={""}
                        width={"192"}
                        height={"192"}
                      />
                    </span>
                  </b>
                </div>
                <span>A CLEAR NEXT STEP</span>
              </div>
              <a className={"op-text-link"} href={"#contact"}>
                Talk through your idea ↗
              </a>
            </div>
            <div className={"op-concern-list"}>
              <article>
                <span className={"op-concern-number"}>01 / FOCUS</span>
                <h3>Too much to build?</h3>
                <p>
                  Start with the journey that matters most to your users. Agree
                  what belongs in the first release, what can wait, and which
                  dependencies need attention.
                </p>
                <span className={"op-concern-answer"}>
                  A useful scope, before a bigger commitment.
                </span>
              </article>
              <article>
                <span className={"op-concern-number"}>02 / VISIBILITY</span>
                <h3>Hard to see progress?</h3>
                <p>
                  Use agreed milestones and working reviews to follow the build.
                  Surface questions and changes while there is still time to
                  make a considered decision.
                </p>
                <span className={"op-concern-answer"}>
                  Reviewable work, with decisions you can follow.
                </span>
              </article>
              <article>
                <span className={"op-concern-number"}>03 / CONTINUITY</span>
                <h3>What happens after launch?</h3>
                <p>
                  Discuss release checks, source and account access,
                  documentation and support boundaries as part of the plan.
                </p>
                <span className={"op-concern-answer"}>
                  A handover with a clear next step.
                </span>
              </article>
            </div>
          </div>
        </section>
        <section
          id={"work"}
          className={"op-section op-work"}
          aria-labelledby={"work-title"}
        >
          <div className={"wrap op-section-heading op-heading-row"}>
            <div>
              <p className={"eyebrow"}>02 / SELECTED WORK</p>
              <h2 id={"work-title"}>
                A closer look
                <br />
                <em>at the work</em>
                <span className={"op-dot"}>.</span>
              </h2>
            </div>
            <p>
              Three projects and two interface concepts.
              <br />
              <Link href={"/work"}>
                <u>Explore the full portfolio</u> ↗
              </Link>
            </p>
          </div>
          <div className={"op-work-stage"}>
            <div className={"op-work-track"}>
              <article className={"op-project op-project-sabi"}>
                <div className={"op-project-copy"}>
                  <span className={"op-project-kind"}>
                    01 / VENTURE PROJECT
                  </span>
                  <h3>
                    SabiWorkers<span>↗</span>
                  </h3>
                  <p className={"op-project-subtitle"}>
                    Opportunity, closer to home.
                  </p>
                  <p data-copy={"home-v2-work"}>
                    A Nigerian marketplace where clients post blue-collar jobs
                    and nearby workers apply. AppsInHours contributed
                    development as a venture partner.
                  </p>
                  <Link className={"op-text-link"} href={"/work#sabiworkers"}>
                    Explore the partnership ↗
                  </Link>
                  <span className={"op-project-note"}>
                    NIGERIA / HIRING MARKETPLACE
                  </span>
                </div>
                <div className={"op-project-visual sabi-visual"}>
                  <span className={"op-visual-label"}>
                    ILLUSTRATIVE INTERFACE / NOT A PRODUCT SCREENSHOT
                  </span>
                  <div className={"sabi-map"} aria-hidden={"true"}>
                    <i className={"sabi-pin p1"}>+</i>
                    <i className={"sabi-pin p2"}>+</i>
                    <i className={"sabi-pin p3"}>+</i>
                    <span className={"sabi-location"} />
                  </div>
                  <div className={"op-mock-phone"} aria-hidden={"true"}>
                    <div className={"mock-island"} />
                    <span className={"mock-brand"}>
                      SabiWorkers<span>⊕</span>
                    </span>
                    <small>GOOD WORK STARTS NEARBY.</small>
                    <strong>
                      Find your
                      <br />
                      next opportunity.
                    </strong>
                    <div className={"mock-search"}>Explore work nearby ↗</div>
                    <div className={"mock-job"}>
                      <b>Find a local opportunity</b>
                      <span>Discover nearby jobs</span>
                      <i>Explore ↗</i>
                    </div>
                    <div className={"mock-job"}>
                      <b>Show what you can do</b>
                      <span>Apply for a suitable job</span>
                      <i>Connect ↗</i>
                    </div>
                    <div className={"mock-phone-nav"}>⌂     ⊕     ○</div>
                  </div>
                  <span className={"sabi-caption"} aria-hidden={"true"}>
                    A JOB.
                    <br />A PLACE.
                    <br />A CONNECTION.
                  </span>
                </div>
              </article>
              <article className={"op-project"}>
                <div className={"op-project-copy"}>
                  <span className={"op-project-kind"}>
                    02 / PRODUCT DEVELOPMENT
                  </span>
                  <h3>FoodChoo</h3>
                  <p className={"op-project-subtitle"}>
                    Food delivery on demand.
                  </p>
                  <p>
                    We built FoodChoo end to end, giving customers a mobile app
                    for ordering food for delivery.
                  </p>
                  <Link className={"op-text-link"} href={"/work#foodchoo"}>
                    View FoodChoo project ↗
                  </Link>
                  <span className={"op-project-note"}>
                    MOBILE APP / FOOD DELIVERY
                  </span>
                </div>
                <div className={"op-project-visual portfolio-photo"}>
                  <img
                    src={"/site/foodchoo-editorial.webp"}
                    width={"1080"}
                    height={"810"}
                    alt={""}
                    loading={"lazy"}
                    decoding={"async"}
                  />
                </div>
              </article>
              <article className={"op-project"}>
                <div className={"op-project-copy"}>
                  <span className={"op-project-kind"}>
                    03 / LOGISTICS PLATFORM
                  </span>
                  <h3>PakGo</h3>
                  <p className={"op-project-subtitle"}>
                    From freight booking to delivery.
                  </p>
                  <p>
                    Shippers book and track freight. Carriers assign loads to
                    trucks, and drivers record pickups and deliveries.
                  </p>
                  <Link className={"op-text-link"} href={"/work#pakgo"}>
                    View PakGo project ↗
                  </Link>
                  <span className={"op-project-note"}>
                    FREIGHT / SHIPPER, CARRIER &amp; DRIVER
                  </span>
                </div>
                <div className={"op-project-visual portfolio-photo"}>
                  <img
                    src={"/site/pakgo-editorial.webp"}
                    width={"1080"}
                    height={"810"}
                    alt={""}
                    loading={"lazy"}
                    decoding={"async"}
                  />
                </div>
              </article>
              <article className={"op-project op-project-commerce"}>
                <div className={"op-project-copy"}>
                  <span className={"op-project-kind"}>
                    04 / INTERFACE CONCEPT
                  </span>
                  <h3>
                    A better
                    <br />
                    way to order.
                  </h3>
                  <p className={"op-project-subtitle"}>
                    Less friction. More flavour.
                  </p>
                  <p>
                    A restaurant ordering interface exploration: a clear menu, a
                    focused selection and a useful next step. This is an
                    original design concept, not commissioned client work.
                  </p>
                  <a
                    className={"op-text-link"}
                    href={"#contact"}
                    data-inquiry-service={"Build a product"}
                    data-area={"web"}
                    data-project-type={"commerce"}
                  >
                    Discuss a commerce product ↗
                  </a>
                  <span className={"op-project-note"}>
                    DESIGN EXPLORATION / RESTAURANT COMMERCE
                  </span>
                </div>
                <div className={"op-project-visual commerce-visual"}>
                  <span className={"op-visual-label"}>
                    INTERFACE CONCEPT / ILLUSTRATIVE BRAND
                  </span>
                  <div className={"op-commerce-window"} aria-hidden={"true"}>
                    <div className={"commerce-nav"}>
                      olive <i>&amp; co.</i>
                      <span>FRESH DAILY   ☰</span>
                    </div>
                    <div className={"commerce-content"}>
                      <small>GOOD FOOD. A LITTLE JOY.</small>
                      <strong>
                        Your lunch.
                        <br />
                        <em>Made lovely.</em>
                      </strong>
                      <span className={"commerce-cta"}>Explore the menu ↗</span>
                      <div className={"commerce-plate"}>
                        <i />
                        <i />
                        <i />
                        <b>
                          olive
                          <br />
                          &amp; co.
                        </b>
                      </div>
                    </div>
                    <div className={"commerce-bottom"}>
                      SEASONAL INGREDIENTS <span>MADE TO ORDER</span>
                    </div>
                  </div>
                </div>
              </article>
              <article className={"op-project op-project-mobile"}>
                <div className={"op-project-copy"}>
                  <span className={"op-project-kind"}>
                    05 / INTERFACE CONCEPT
                  </span>
                  <h3>
                    Everyday,
                    <br />
                    elevated.
                  </h3>
                  <p className={"op-project-subtitle"}>
                    A mobile concept for tracking daily progress.
                  </p>
                  <p>
                    A mobile interface exploration around clear progress and
                    simple daily interactions. An illustrative experience, not a
                    delivered product or a claim of measured results.
                  </p>
                  <a
                    className={"op-text-link"}
                    href={"#contact"}
                    data-inquiry-service={"Build a product"}
                    data-area={"mobile"}
                    data-project-type={"mobile"}
                  >
                    Discuss a mobile experience ↗
                  </a>
                  <span className={"op-project-note"}>
                    DESIGN EXPLORATION / MOBILE EXPERIENCE
                  </span>
                </div>
                <div className={"op-project-visual mobile-visual"}>
                  <span className={"op-visual-label"}>
                    INTERFACE CONCEPT / ILLUSTRATIVE PRODUCT
                  </span>
                  <div className={"mobile-orbit"} aria-hidden={"true"} />
                  <div
                    className={"op-mock-phone everyday-phone"}
                    aria-hidden={"true"}
                  >
                    <div className={"mock-island"} />
                    <span className={"mock-brand"}>
                      everyday<span>+</span>
                    </span>
                    <small>YOUR EVERYDAY, REIMAGINED.</small>
                    <strong>
                      Make room
                      <br />
                      for <em>better.</em>
                    </strong>
                    <div className={"everyday-progress"}>
                      <small>YOUR PROGRESS</small>
                      <b>One step closer.</b>
                      <i />
                      <span>Keep your momentum ↗</span>
                    </div>
                    <div className={"everyday-tiles"}>
                      <span>
                        ✳<small>Discover</small>
                      </span>
                      <span>
                        ↗<small>Activity</small>
                      </span>
                    </div>
                    <div className={"mock-phone-nav"}>⌂     ⊕     ○</div>
                  </div>
                  <span className={"mobile-caption"} aria-hidden={"true"}>
                    USEFUL.
                    <br />
                    INTUITIVE.
                    <br />
                    HUMAN.
                  </span>
                </div>
              </article>
            </div>
            <div className={"op-work-controls wrap"} hidden>
              <span className={"op-work-counter"} aria-live={"polite"}>
                01 / 05
              </span>
              <div className={"op-work-dots"} aria-label={"Choose project"}>
                <button
                  type={"button"}
                  data-work={"0"}
                  aria-label={"Show SabiWorkers"}
                  aria-pressed={"true"}
                />
                <button
                  type={"button"}
                  data-work={"1"}
                  aria-label={"Show FoodChoo"}
                  aria-pressed={"false"}
                />
                <button
                  type={"button"}
                  data-work={"2"}
                  aria-label={"Show PakGo"}
                  aria-pressed={"false"}
                />
                <button
                  type={"button"}
                  data-work={"3"}
                  aria-label={"Show commerce concept"}
                  aria-pressed={"false"}
                />
                <button
                  type={"button"}
                  data-work={"4"}
                  aria-label={"Show mobile concept"}
                  aria-pressed={"false"}
                />
              </div>
              <span>SCROLL TO EXPLORE →</span>
            </div>
          </div>
          <div className={"wrap op-conversation"}>
            <div>
              <p className={"eyebrow"}>YOUR PRODUCT COULD START HERE</p>
              <h3>What would you like to make possible?</h3>
              <p>
                Bring the user journey, the problem, or the product you want to
                improve.
              </p>
            </div>
            <a className={"primary-link"} href={"#contact"}>
              Discuss your project <span>↗</span>
            </a>
          </div>
        </section>
        <section
          id={"services"}
          className={"op-section op-services wrap"}
          aria-labelledby={"services-title"}
        >
          <div className={"op-section-heading op-heading-row"}>
            <div>
              <p className={"eyebrow"}>03 / WHAT YOU CAN BUILD</p>
              <h2 id={"services-title"}>
                What do you
                <br />
                <em>want to build</em>
                <span className={"op-dot"}>?</span>
              </h2>
            </div>
            <p>
              Start with the part you need.
              <br />
              Open a service to see where we can help.
            </p>
          </div>
          <div className={"op-service-grid"}>
            <details className={"op-service op-service-feature"}>
              <summary>
                <span className={"op-service-top"}>
                  <span>01 / DEFINE</span>
                  <i aria-hidden={"true"}>+</i>
                </span>
                <div
                  className={"op-service-art art-scope"}
                  aria-hidden={"true"}
                >
                  <span className={"scope-ring"} />
                  <span className={"scope-ring second"} />
                  <span className={"scope-axis"} />
                  <b>IDEA</b>
                  <small>ONE CLEAR DIRECTION</small>
                </div>
                <h3>
                  Product scoping
                  <br />
                  &amp; prototyping
                </h3>
                <p>Test a product idea before investing in a full build.</p>
              </summary>
              <div className={"op-service-detail"}>
                <p>
                  Clarify users, essential journeys, dependencies and what a
                  useful first version needs. Explore the interface before
                  committing to the full build.
                </p>
                <a
                  href={"#contact"}
                  data-inquiry-service={"Build a product"}
                  data-area={"scoping"}
                >
                  Shape your idea ↗
                </a>
              </div>
            </details>
            <details className={"op-service"}>
              <summary>
                <span className={"op-service-top"}>
                  <span>02 / WEB</span>
                  <i aria-hidden={"true"}>+</i>
                </span>
                <div className={"op-service-art art-web"} aria-hidden={"true"}>
                  <span>
                    <b>• • •</b>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <b>• • •</b>
                    <i />
                    <i />
                  </span>
                </div>
                <h3>Web applications</h3>
                <p>Give customers a portal or your team an internal tool.</p>
              </summary>
              <div className={"op-service-detail"}>
                <p>
                  Business websites, customer portals and web applications,
                  built around the journeys and systems your product needs.
                </p>
                <a
                  href={"#contact"}
                  data-inquiry-service={"Build a product"}
                  data-area={"web"}
                >
                  Discuss your web product ↗
                </a>
              </div>
            </details>
            <details className={"op-service"}>
              <summary>
                <span className={"op-service-top"}>
                  <span>03 / MOBILE</span>
                  <i aria-hidden={"true"}>+</i>
                </span>
                <div
                  className={"op-service-art art-device"}
                  aria-hidden={"true"}
                >
                  <span>
                    <b />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <h3>Mobile applications</h3>
                <p>Put a customer or staff workflow on iOS and Android.</p>
              </summary>
              <div className={"op-service-detail"}>
                <p>
                  iOS, Android and React Native development. Agree the platform,
                  essential interactions, integrations and release requirements.
                </p>
                <a
                  href={"#contact"}
                  data-inquiry-service={"Build a product"}
                  data-area={"mobile"}
                >
                  Plan your mobile app ↗
                </a>
              </div>
            </details>
            <details className={"op-service"}>
              <summary>
                <span className={"op-service-top"}>
                  <span>04 / CONNECT</span>
                  <i aria-hidden={"true"}>+</i>
                </span>
                <div
                  className={"op-service-art art-nodes"}
                  aria-hidden={"true"}
                >
                  <span>API</span>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <h3>Backend &amp; integrations</h3>
                <p>
                  Connect your app to payments, accounts or existing systems.
                </p>
              </summary>
              <div className={"op-service-detail"}>
                <p>
                  APIs, authentication, business rules and connections to other
                  services, with data access and ownership agreed in scope.
                </p>
                <a
                  href={"#contact"}
                  data-inquiry-service={"Build a product"}
                  data-area={"backend"}
                >
                  Connect your systems ↗
                </a>
              </div>
            </details>
            <details className={"op-service"}>
              <summary>
                <span className={"op-service-top"}>
                  <span>05 / EVOLVE</span>
                  <i aria-hidden={"true"}>+</i>
                </span>
                <div
                  className={"op-service-art art-improve"}
                  aria-hidden={"true"}
                >
                  <i />
                  <i />
                  <i />
                  <i />
                  <span>↗</span>
                </div>
                <h3>Improve &amp; extend</h3>
                <p>
                  Add features or engineering capacity to an existing product.
                </p>
              </summary>
              <div className={"op-service-detail"}>
                <p>
                  Scoped features, fixes and development support for an existing
                  product. Agree the starting point, capacity and review
                  process.
                </p>
                <a
                  href={"#contact"}
                  data-inquiry-service={"Improve an existing product"}
                  data-area={"improvement"}
                >
                  Find the next improvement ↗
                </a>
              </div>
            </details>
          </div>
          <div className={"op-section-foot"}>
            <span>From a booking journey to a connected marketplace.</span>
            <Link href={"/services#solutions"}>
              Explore seven project types ↗
            </Link>
          </div>
        </section>
        <section
          id={"process"}
          className={"op-section op-process wrap"}
          aria-labelledby={"process-title"}
        >
          <div className={"op-section-heading"}>
            <p className={"eyebrow"}>04 / HOW IT WORKS</p>
            <h2 id={"process-title"}>
              From first conversation
              <br />
              <em>to the next release</em>
              <span className={"op-dot"}>.</span>
            </h2>
          </div>
          <div className={"op-about-grid"}>
            <div className={"op-about-sticky"}>
              <p className={"op-process-lead"}>
                A plan you can understand.
                <br />
                Progress you can review.
              </p>
              <p>
                Each stage answers a practical question: what are we building,
                how will we review it, and what needs to happen next?
              </p>
              <a className={"primary-link"} href={"#contact"}>
                Discuss your project <span>↗</span>
              </a>
              <p className={"op-process-note"}>
                You can start with a few sentences.
                <br />A finished specification is not required.
              </p>
              <Link className={"op-text-link"} href={"/studio"}>
                More about our studio ↗
              </Link>
            </div>
            <div className={"op-timeline"}>
              <article>
                <span className={"op-step"}>01</span>
                <p className={"eyebrow"}>START WITH THE GOAL</p>
                <h3>
                  Tell us what
                  <br />
                  needs to change.
                </h3>
                <p>
                  Who is the product for? What should they be able to do? Share
                  your idea or existing product, along with any budget, date or
                  technical constraints you already know.
                </p>
                <span className={"op-tags"}>
                  THE USER / THE GOAL / THE STARTING POINT
                </span>
              </article>
              <article>
                <span className={"op-step"}>02</span>
                <p className={"eyebrow"}>AGREE THE PLAN</p>
                <h3>
                  Make the scope
                  <br />
                  and terms clear.
                </h3>
                <p>
                  Discuss deliverables, dependencies, milestones, review
                  criteria and commercial terms. The proposal sets out the work
                  and timing before the build begins.
                </p>
                <span className={"op-tags"}>SCOPE / MILESTONES / PROPOSAL</span>
              </article>
              <article>
                <span className={"op-step"}>03</span>
                <p className={"eyebrow"}>DESIGN &amp; BUILD</p>
                <h3>
                  See the product
                  <br />
                  take shape.
                </h3>
                <p>
                  Try the feature as a user would. Tell us what works and what
                  needs to change before the next release.
                </p>
                <span className={"op-tags"}>
                  DESIGN / ENGINEERING / WORKING REVIEWS
                </span>
              </article>
              <article>
                <span className={"op-step"}>04</span>
                <p className={"eyebrow"}>REVIEW &amp; HANDOVER</p>
                <h3>
                  Prepare for
                  <br />
                  real use.
                </h3>
                <p>
                  Check the agreed journeys and release requirements. Confirm
                  deployment responsibilities, source and account access, and
                  setup documentation under the project agreement.
                </p>
                <span className={"op-tags"}>CHECKS / RELEASE / HANDOVER</span>
              </article>
              <article>
                <span className={"op-step"}>05</span>
                <p className={"eyebrow"}>PLAN WHAT COMES NEXT</p>
                <h3>
                  Make the next
                  <br />
                  move deliberately.
                </h3>
                <p>
                  New priorities may need a focused improvement or ongoing
                  development support. Agree the next scope, available capacity
                  and support arrangements separately.
                </p>
                <span className={"op-tags"}>
                  NEXT PRIORITIES / SUPPORT / ITERATION
                </span>
              </article>
            </div>
          </div>
        </section>
        <section
          id={"ventures"}
          className={"op-section op-ventures wrap"}
          aria-labelledby={"ventures-title"}
        >
          <div className={"op-venture-layout"}>
            <div className={"op-venture-copy"}>
              <p className={"eyebrow"}>05 / APPSINHOURS VENTURES</p>
              <h2 id={"ventures-title"}>
                Your MVP.
                <br />
                <em>No upfront</em>
                <br />
                development fee<span className={"op-dot"}>.</span>
              </h2>
              <p className={"op-venture-intro"} data-copy={"home-v3-venture"}>
                Bring your customer research and a plan to reach buyers.
                Together we agree what the first release needs to do.
              </p>
              <div className={"op-actions"}>
                <a
                  className={"primary-link"}
                  href={"#contact"}
                  data-inquiry-venture={""}
                >
                  Apply for an MVP partnership <span>↗</span>
                </a>
                <Link
                  className={"op-text-link"}
                  href={"/ventures#partnership-terms"}
                >
                  Read the partnership terms ↗
                </Link>
              </div>
              <p className={"op-venture-condition"}>
                Applications are reviewed for fit. External costs are separate.
                Acceptance and terms are not guaranteed.
              </p>
            </div>
            <div className={"op-venture-exchange"}>
              <div className={"op-venture-panel-top"}>
                <span>THE PARTNERSHIP</span>
                <span>FOUNDER + STUDIO</span>
              </div>
              <div className={"op-venture-symbol"} aria-hidden={"true"}>
                <svg viewBox={"0 0 500 300"} fill={"none"}>
                  <ellipse
                    className={"venture-orbit"}
                    cx={"188"}
                    cy={"150"}
                    rx={"122"}
                    ry={"92"}
                  />
                  <ellipse
                    className={"venture-orbit"}
                    cx={"312"}
                    cy={"150"}
                    rx={"122"}
                    ry={"92"}
                  />
                  <ellipse
                    className={"venture-orbit venture-orbit-inner"}
                    cx={"250"}
                    cy={"150"}
                    rx={"128"}
                    ry={"102"}
                  />
                  <path
                    className={"venture-connector"}
                    d={"M66 150H434M250 48V252"}
                  />
                  <circle
                    className={"venture-pin"}
                    cx={"66"}
                    cy={"150"}
                    r={"4"}
                  />
                  <circle
                    className={"venture-pin"}
                    cx={"434"}
                    cy={"150"}
                    r={"4"}
                  />
                  <circle
                    className={"venture-core"}
                    cx={"250"}
                    cy={"150"}
                    r={"47"}
                  />
                </svg>
                <span>
                  ONE MVP
                  <br />
                  <strong>A SHARED STAKE</strong>
                </span>
              </div>
              <div className={"op-venture-contributions"}>
                <div>
                  <span>YOU BRING</span>
                  <h3>
                    Customer insight.
                    <br />
                    Founder commitment.
                  </h3>
                  <p>
                    A real problem, evidence to discuss, and time to build the
                    business.
                  </p>
                </div>
                <div>
                  <span>WE BRING</span>
                  <h3>
                    Technical scope.
                    <br />
                    MVP development.
                  </h3>
                  <p>
                    An agreed first release, reviewable milestones and defined
                    handover.
                  </p>
                </div>
              </div>
              <div className={"op-venture-terms"}>
                <span>Development for equity</span>
                <span>Agreed MVP scope</span>
                <span>External costs separate</span>
              </div>
            </div>
          </div>
          <div className={"op-venture-path"}>
            <div className={"op-venture-path-heading"}>
              <h3>
                A shared decision.
                <br />
                <em>Before the build.</em>
              </h3>
              <p>Four steps to find the fit and agree the commitment.</p>
            </div>
            <ol className={"op-venture-steps"}>
              <li>
                <span className={"op-venture-step"}>01</span>
                <h4>Introduce the idea</h4>
                <p>
                  Share the customer problem, what you have learned and your
                  role.
                </p>
              </li>
              <li>
                <span className={"op-venture-step"}>02</span>
                <h4>Explore the fit</h4>
                <p>
                  Discuss founder commitment, feasibility and reaching
                  customers.
                </p>
              </li>
              <li>
                <span className={"op-venture-step"}>03</span>
                <h4>Define the MVP</h4>
                <p>
                  Agree the essential journey, features, exclusions and review
                  points.
                </p>
              </li>
              <li>
                <span className={"op-venture-step"}>04</span>
                <h4>Agree the partnership</h4>
                <p>
                  Record equity, ownership, cost responsibilities and ongoing
                  involvement.
                </p>
              </li>
            </ol>
          </div>
          <div className={"op-venture-proof"}>
            <div>
              <span className={"eyebrow"}>A VENTURE EXAMPLE</span>
              <p>
                <strong>SabiWorkers.</strong> A hiring marketplace built with
                our contribution as a venture partner.
              </p>
              <Link className={"op-text-link"} href={"/work#sabiworkers"}>
                Read the project story ↗
              </Link>
            </div>
            <div>
              <p>Have a customer problem worth solving?</p>
              <a
                className={"primary-link"}
                href={"#contact"}
                data-inquiry-venture={""}
              >
                Apply for an MVP partnership <span>↗</span>
              </a>
            </div>
          </div>
        </section>
        <section
          id={"pricing"}
          className={"op-section op-pricing wrap"}
          aria-labelledby={"pricing-title"}
        >
          <div className={"op-section-heading op-heading-row"}>
            <div>
              <p className={"eyebrow"}>06 / SERVICES &amp; STARTING POINTS</p>
              <h2 id={"pricing-title"}>
                Our <em>Pricing</em>
                <span className={"op-dot"}>.</span>
              </h2>
            </div>
            <p>
              Open a service to compare scopes.
              <br />
              Reference rates — subject to confirmation.
            </p>
          </div>
          <p className={"op-pricing-intro"} data-copy={"home-v2-scope"}>
            Choose a starting point for the conversation. Your proposal will
            define the deliverables, dependencies, cost and timing for the work
            you agree to.
          </p>
          <div className={"pricing-venture"}>
            <div className={"pricing-venture-story"}>
              <p className={"eyebrow"}>FOR SELECTED FOUNDERS</p>
              <h3>
                Your idea.
                <br />
                Our MVP contribution.
              </h3>
              <p>
                Build an agreed MVP without an upfront development fee, in
                exchange for equity.
              </p>
              <ol className={"pricing-venture-steps"}>
                <li>Share your idea</li>
                <li>Agree the MVP</li>
                <li>Build together</li>
              </ol>
              <small>
                Selection is not guaranteed. Equity, scope and responsibilities
                are agreed before work begins.
              </small>
            </div>
            <aside className={"pricing-venture-offer"}>
              <p className={"eyebrow"}>MVP PARTNERSHIP</p>
              <strong>$0</strong>
              <p>upfront development fee</p>
              <hr />
              <p>
                In exchange for agreed equity.
                <br />
                External costs are separate.
              </p>
              <a
                className={"primary-link"}
                href={"#contact"}
                data-inquiry-venture={""}
              >
                Apply for an MVP partnership <span aria-hidden={"true"}>↗</span>
              </a>
              <small>
                Scope, ownership, support and continuing involvement agreed
                separately.{" "}
                <Link href={"/ventures"}>Partnership details ↗</Link>
              </small>
            </aside>
          </div>
          <p className={"pricing-review-note"}>
            Starter prices are examples. We confirm availability, deliverables,
            timing and ongoing costs in your proposal.
          </p>
          <div className={"pricing-matrix"}>
            <details className={"pricing-service"}>
              <summary>
                <span className={"pricing-number"}>01</span>
                <h3>Blockchain Development</h3>
                <span className={"pricing-code"} aria-hidden={"true"} />
                <span className={"pricing-rate"}>
                  <small>Example</small> $5,000
                </span>
                <span className={"pricing-disclosure"} aria-hidden={"true"} />
              </summary>
              <div className={"pricing-panel"}>
                <div className={"pricing-tiers"}>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Starter</p>
                    <div className={"pricing-tier-price"}>$5,000</div>
                    <small>reference price / project</small>
                    <p>
                      Example brief: “Could we get a written assessment of this
                      use case and a plan for testing a prototype?”
                    </p>
                    <ul>
                      <li>Use-case assessment</li>
                      <li>Prototype scope</li>
                      <li>Security requirements</li>
                    </ul>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Blockchain Development / Starter"}
                    >
                      Discuss Starter <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier pricing-tier-feature"}>
                    <p className={"eyebrow"}>Growth</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      Which existing workflow needs a blockchain integration?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Blockchain Development / Growth"}
                    >
                      Discuss Growth <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Enterprise</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      Which systems or partners would need to share records?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={
                        "Blockchain Development / Enterprise"
                      }
                    >
                      Request a proposal <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                </div>
              </div>
            </details>
            <details className={"pricing-service"}>
              <summary>
                <span className={"pricing-number"}>02</span>
                <h3>Web App Development</h3>
                <span className={"pricing-code"} aria-hidden={"true"} />
                <span className={"pricing-rate"}>
                  <small>Example</small> $5,000
                </span>
                <span className={"pricing-disclosure"} aria-hidden={"true"} />
              </summary>
              <div className={"pricing-panel"}>
                <div className={"pricing-tiers"}>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Starter</p>
                    <div className={"pricing-tier-price"}>$5,000</div>
                    <small>reference price / project</small>
                    <p>
                      Example brief: “Could we get a working web flow that lets
                      customers submit a request and staff review it?”
                    </p>
                    <ul>
                      <li>User journeys</li>
                      <li>Core web experience</li>
                      <li>Release planning</li>
                    </ul>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Web App Development / Starter"}
                    >
                      Discuss Starter <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier pricing-tier-feature"}>
                    <p className={"eyebrow"}>Growth</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>Which feature would help your current web app users?</p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Web App Development / Growth"}
                    >
                      Discuss Growth <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Enterprise</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      Which teams need access, and what should each be able to
                      do?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Web App Development / Enterprise"}
                    >
                      Request a proposal <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                </div>
              </div>
            </details>
            <details className={"pricing-service"}>
              <summary>
                <span className={"pricing-number"}>03</span>
                <h3>Mobile App Development</h3>
                <span className={"pricing-code"} aria-hidden={"true"} />
                <span className={"pricing-rate"}>
                  <small>Example</small> $3,500
                </span>
                <span className={"pricing-disclosure"} aria-hidden={"true"} />
              </summary>
              <div className={"pricing-panel"}>
                <div className={"pricing-tiers"}>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Starter</p>
                    <div className={"pricing-tier-price"}>$3,500</div>
                    <small>reference price / project</small>
                    <p>
                      Example brief: “Could we test one core task on the devices
                      our customers use?”
                    </p>
                    <ul>
                      <li>Platform discovery</li>
                      <li>Core app journeys</li>
                      <li>Device and release planning</li>
                    </ul>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Mobile App Development / Starter"}
                    >
                      Discuss Starter <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier pricing-tier-feature"}>
                    <p className={"eyebrow"}>Growth</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      What would you add to the app your customers use today?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"Mobile App Development / Growth"}
                    >
                      Discuss Growth <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Enterprise</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      Which devices, accounts and backend systems must work
                      together?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={
                        "Mobile App Development / Enterprise"
                      }
                    >
                      Request a proposal <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                </div>
              </div>
            </details>
            <details className={"pricing-service"}>
              <summary>
                <span className={"pricing-number"}>04</span>
                <h3>AI Agent Development</h3>
                <span className={"pricing-code"} aria-hidden={"true"} />
                <span className={"pricing-rate"}>
                  <small>Example</small> $2,000
                </span>
                <span className={"pricing-disclosure"} aria-hidden={"true"} />
              </summary>
              <div className={"pricing-panel"}>
                <div className={"pricing-tiers"}>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Starter</p>
                    <div className={"pricing-tier-price"}>$2,000</div>
                    <small>reference price / project</small>
                    <p>
                      Example brief: “Could we assess one task for an agent and
                      agree how to test its results?”
                    </p>
                    <ul>
                      <li>Task and boundary definition</li>
                      <li>Agent prototype scope</li>
                      <li>Evaluation planning</li>
                    </ul>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"AI Agent Development / Starter"}
                    >
                      Discuss Starter <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier pricing-tier-feature"}>
                    <p className={"eyebrow"}>Growth</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>Where does your current automation need human review?</p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"AI Agent Development / Growth"}
                    >
                      Discuss Growth <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Enterprise</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      Which data sources and permissions would the agent need?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"AI Agent Development / Enterprise"}
                    >
                      Request a proposal <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                </div>
              </div>
            </details>
            <details className={"pricing-service"}>
              <summary>
                <span className={"pricing-number"}>05</span>
                <h3>WordPress Development</h3>
                <span className={"pricing-code"} aria-hidden={"true"} />
                <span className={"pricing-rate"}>
                  <small>Example</small> $1,000
                </span>
                <span className={"pricing-disclosure"} aria-hidden={"true"} />
              </summary>
              <div className={"pricing-panel"}>
                <div className={"pricing-tiers"}>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Starter</p>
                    <div className={"pricing-tier-price"}>$1,000</div>
                    <small>reference price / project</small>
                    <p>
                      Example brief: “Could we get a page template our editors
                      can update themselves?”
                    </p>
                    <ul>
                      <li>Content structure</li>
                      <li>Page template scope</li>
                      <li>Editor handover planning</li>
                    </ul>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"WordPress Development / Starter"}
                    >
                      Discuss Starter <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier pricing-tier-feature"}>
                    <p className={"eyebrow"}>Growth</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      What should visitors be able to do on your existing site?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={"WordPress Development / Growth"}
                    >
                      Discuss Growth <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                  <article className={"pricing-tier"}>
                    <p className={"eyebrow"}>Enterprise</p>
                    <div className={"pricing-tier-price"}>Let’s scope it</div>
                    <small>custom proposal</small>
                    <p>
                      Which sites, editors and publishing permissions do you
                      manage?
                    </p>
                    <a
                      href={"#contact"}
                      className={"primary-link"}
                      data-inquiry-service={"Build a product"}
                      data-pricing-context={
                        "WordPress Development / Enterprise"
                      }
                    >
                      Request a proposal <span aria-hidden={"true"}>↗</span>
                    </a>
                  </article>
                </div>
              </div>
            </details>
          </div>
          <div className={"op-conversation op-conversation-compact"}>
            <div>
              <h3>Need a custom solution?</h3>
              <p>A project plan shaped around your business.</p>
            </div>
            <a className={"op-text-link"} href={"#contact"}>
              Get a quote ↗
            </a>
          </div>
          <div className={"op-section-foot"}>
            <span>
              Reference rates are for discussion. Final scope, availability and
              commercial terms require confirmation.
            </span>
            <Link href={"/engagements"}>Engagement details ↗</Link>
          </div>
        </section>
        <section
          id={"faq"}
          className={"op-section op-faq wrap"}
          aria-labelledby={"faq-title"}
        >
          <div className={"op-section-heading"}>
            <p className={"eyebrow"}>07 / BEFORE WE BEGIN</p>
            <h2 id={"faq-title"}>
              Good questions.
              <br />
              <em>Clearer decisions</em>
              <span className={"op-dot"}>.</span>
            </h2>
          </div>
          <div className={"op-faq-grid"}>
            <div className={"op-faq-intro"}>
              <p>
                Scope, timing, ownership and what comes after launch. Here are
                the questions worth asking before a build.
              </p>
              <p>Have something more specific in mind?</p>
              <a className={"op-text-link"} href={"#contact"}>
                Discuss your project ↗
              </a>
            </div>
            <div className={"op-faq-list"}>
              <details>
                <summary>
                  <span className={"op-faq-number"}>01</span>
                  <span>Can I start with just an idea?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    Yes. Tell us who the product is for, the problem it should
                    solve, and what you know so far. Scoping or a prototype can
                    help clarify a first release before committing to a larger
                    build.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>02</span>
                  <span>How much will my project cost?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    The cost depends on the agreed scope, integrations, existing
                    systems and delivery responsibilities. We discuss those
                    inputs and the commercial approach before you commit. For
                    team support, rates and available capacity are agreed
                    separately.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>03</span>
                  <span>How long will it take?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    Timing is agreed after the scope and dependencies are
                    understood. Share any target date early so we can discuss
                    what is feasible, what needs to be ready, and what could
                    affect the plan.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>04</span>
                  <span>Can you work on a product that already exists?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    Yes. We can discuss a focused feature, fixes, integrations
                    or development support. The starting point depends on the
                    codebase, access, priorities and available capacity.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>05</span>
                  <span>What if the requirements change?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    Tell us what needs to change. We’ll explain the effect on
                    price and timing so you can decide whether to go ahead.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>06</span>
                  <span>What will I receive at handover?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    The agreement defines deliverables, ownership, source and
                    account access, documentation and deployment
                    responsibilities. Third-party services and licences are
                    clarified as part of the scope.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>07</span>
                  <span>What about support after launch?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    Support, maintenance and future features are discussed
                    separately, with their own responsibilities, scope and
                    commercial terms. We can discuss what your product will need
                    before handover.
                  </p>
                </div>
              </details>
              <details>
                <summary>
                  <span className={"op-faq-number"}>08</span>
                  <span>Can you build my MVP without an upfront fee?</span>
                  <i aria-hidden={"true"}>+</i>
                </summary>
                <div className={"op-faq-answer"}>
                  <p>
                    For selected founders, yes: there is no upfront development
                    fee for the agreed MVP scope. Equity is the consideration.
                    External costs such as hosting, paid services and marketing
                    are separate, and acceptance is not guaranteed. Ownership,
                    scope and continuing work are agreed before development
                    begins. <a href={"#ventures"}>See the MVP partnership ↗</a>
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>
        <section
          id={"contact"}
          className={"op-section op-contact contact-v2 wrap"}
          aria-labelledby={"contact-title"}
        >
          <div className={"op-section-heading"}>
            <p className={"eyebrow"}>08 / START THE CONVERSATION</p>
            <h2 id={"contact-title"}>
              Let's talk about
              <br />
              <em>your next step</em>
              <span className={"op-dot"}>.</span>
            </h2>
          </div>
          <div className={"op-contact-grid"}>
            <div className={"op-contact-copy"}>
              <p data-copy={"home-v2-close"}>
                Tell us about your idea, existing product or the workflow you
                want to improve. A few sentences about the goal and your
                constraints are enough to start.
              </p>
              <a
                className={"op-contact-email"}
                href={"mailto:inquiry@appsinhours.com"}
              >
                inquiry@appsinhours.com ↗
              </a>
              <div className={"op-next-steps"}>
                <p className={"eyebrow"}>WHAT HAPPENS NEXT</p>
                <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <strong>We review your enquiry.</strong>
                      <p>
                        We read your brief to understand who the product is for
                        and where you need help.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>We discuss the details.</strong>
                      <p>
                        Clarify the scope, dependencies and a suitable way to
                        work together.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>Agree a next step.</strong>
                      <p>
                        If there is a fit, define the work and commercial terms
                        before starting.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
              <p className={"op-contact-note"}>
                A few sentences are enough to begin.
                <br />
                We can work out the details together.
              </p>
            </div>
            <form id={"brief"}>
              <p id="send-status" role="status">
                Online enquiries are unavailable. Email{" "}
                <a href="mailto:inquiry@appsinhours.com">
                  inquiry@appsinhours.com
                </a>{" "}
                to contact the studio.
              </p>
              <label>
                What would you like to do?
                <select name={"service"} required>
                  <option value={"Build a product"}>Build a new product</option>
                  <option>Improve an existing product</option>
                  <option value={"Engineering support"}>
                    Add engineering support to my team
                  </option>
                  <option
                    value={"Venture partnership — development for equity"}
                  >
                    Apply for an MVP partnership
                  </option>
                  <option>Let’s figure it out</option>
                </select>
              </label>
              <label>
                <span id={"message-question"}>
                  Who will use the software, and what should it help them do?
                </span>
                <textarea
                  name={"message"}
                  placeholder={
                    "For example: I want independent tutors to let students book a first lesson."
                  }
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={3}
                />
              </label>
              <label>
                Your name
                <input
                  name={"name"}
                  autoComplete={"name"}
                  placeholder={"What should we call you?"}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Email address
                <input
                  name={"email"}
                  pattern={"[^\\s@]+@[^\\s@]+\\.[^\\s@]+"}
                  maxLength={254}
                  type={"email"}
                  autoComplete={"email"}
                  placeholder={"you@company.com"}
                  required
                />
              </label>
              <div id={"venture-fields"} hidden>
                <p>
                  Tell us what you’ve learned from customers, how you’ll reach
                  them and what the MVP needs to do.{" "}
                  <Link
                    href={"/ventures#evaluation"}
                    target={"_blank"}
                    rel={"noopener"}
                  >
                    Review the criteria (opens in a new tab)
                  </Link>
                  .
                </p>
                <label>
                  What have you learned from potential customers?
                  <textarea
                    name={"validation"}
                    rows={3}
                    maxLength={3000}
                    placeholder={
                      "Customer conversations, early users, pilots, or other evidence of demand"
                    }
                  />
                </label>
                <label>
                  Your role and plan to reach customers
                  <textarea
                    name={"founderPlan"}
                    rows={3}
                    maxLength={3000}
                    placeholder={
                      "Your experience, time commitment, and how you plan to acquire customers"
                    }
                  />
                </label>
                <label>
                  Company stage
                  <select name={"companyStage"}>
                    <option value={""}>Select company stage</option>
                    <option>Not incorporated yet</option>
                    <option>Incorporated, pre-launch</option>
                    <option>Product launched</option>
                    <option>Prefer to discuss</option>
                  </select>
                </label>
                <label>
                  What must the first release let a customer do?
                  <textarea
                    name={"mvpJourney"}
                    rows={3}
                    maxLength={2000}
                    placeholder={
                      "Describe one essential customer journey, rather than a full feature wishlist"
                    }
                  />
                </label>
                <label>
                  How much time can you commit, and how will you cover costs
                  such as hosting?
                  <textarea
                    name={"commitment"}
                    rows={3}
                    maxLength={2000}
                    placeholder={
                      "Time you can commit, and how hosting, app-store accounts, paid services, and customer acquisition would be funded"
                    }
                  />
                </label>
                <label className={"venture-ack"}>
                  <input type={"checkbox"} name={"equityAck"} />{" "}
                  <span>
                    I understand that an accepted partnership exchanges
                    development for equity. External costs and continuing
                    support are agreed separately.
                  </span>
                </label>
              </div>
              <p id={"selected-context"} role={"status"} hidden />
              <details className={"brief-optional"}>
                <summary>Add optional project details</summary>
                <label>
                  Which expertise might you need? (optional)
                  <select name={"serviceArea"} disabled>
                    <option value={""}>Not sure / no preference</option>
                    <option value={"scoping"}>
                      Product scoping and prototyping
                    </option>
                    <option value={"web"}>Web application development</option>
                    <option value={"mobile"}>
                      Mobile application development
                    </option>
                    <option value={"backend"}>Backend and integrations</option>
                    <option value={"improvement"}>Product modernization</option>
                    <option value={"saas"}>SaaS engineering</option>
                    <option value={"support"}>
                      Dedicated engineering support
                    </option>
                  </select>
                </label>
                <label>
                  What kind of product are you considering? (optional)
                  <select name={"projectType"} disabled>
                    <option value={""}>Not sure / no preference</option>
                    <option value={"website"}>Business website</option>
                    <option value={"saas"}>SaaS MVP</option>
                    <option value={"commerce"}>Commerce and ordering</option>
                    <option value={"bookings"}>Booking and scheduling</option>
                    <option value={"marketplace"}>Marketplace</option>
                    <option value={"portal"}>Customer or staff portal</option>
                    <option value={"mobile"}>Mobile product</option>
                    <option value={"business-software"}>
                      Business operations software
                    </option>
                  </select>
                </label>
                <label>
                  Company or project name (optional)
                  <input
                    name={"company"}
                    maxLength={150}
                    autoComplete={"organization"}
                  />
                </label>
                <label>
                  Budget or capacity you have in mind (optional)
                  <input
                    name={"budget"}
                    maxLength={150}
                    placeholder={
                      "Include currency, or approximate hours per week"
                    }
                  />
                </label>
                <label>
                  Any deadline or dependency we should plan around? (optional)
                  <input
                    name={"timeline"}
                    maxLength={150}
                    placeholder={"When would you like to begin?"}
                  />
                </label>
                <label>
                  What business area should we focus on?
                  <select name={"solution"}>
                    <option>Let’s define it together</option>
                    <option>Commerce &amp; ordering</option>
                    <option>Bookings &amp; service businesses</option>
                    <option>Connected mobile product</option>
                    <option>Portals &amp; operational tools</option>
                    <option>Another business need</option>
                  </select>
                </label>
                <label id={"support-arrangement"} hidden>
                  Preferred support arrangement (optional)
                  <select name={"supportArrangement"} disabled>
                    <option value={""}>Let’s discuss it</option>
                    <option>Hourly development</option>
                    <option>Reserved weekly development support</option>
                  </select>
                </label>
                <label>
                  Preferred platform or technology (optional)
                  <select name={"technology"}>
                    <option>Let’s define it together</option>
                    <option>Web</option>
                    <option>iOS and Android</option>
                    <option>iOS</option>
                    <option>Android</option>
                    <option>React.js</option>
                    <option>Node.js</option>
                    <option>React Native</option>
                    <option>Multiple technologies</option>
                  </select>
                </label>
              </details>
              <div id={"send-panel"}>
                <p>
                  We’ll use your details to review and respond to your enquiry.{" "}
                  <Link href={"/privacy"} target={"_blank"} rel={"noopener"}>
                    Privacy details (opens in a new tab)
                  </Link>
                </p>
                <div id={"verification"} />
                <button type={"submit"} id={"send-enquiry"} disabled>
                  Send enquiry ↗
                </button>
              </div>
              <div className={"honeypot"} aria-hidden={"true"}>
                <label>
                  Leave this empty
                  <input name={"website"} autoComplete={"off"} tabIndex={-1} />
                </label>
              </div>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}

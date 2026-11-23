import Link from "next/link";
export const metadata = {
  title: "Discuss a Software Project or MVP Partnership | AppsInHours",
  description:
    "Tell us about your software project, engineering support needs or venture idea. Share who the product serves and the work you need help with.",
  alternates: {
    canonical: "https://appsinhours.com/contact",
  },
  openGraph: {
    title: "Discuss a Software Project or MVP Partnership | AppsInHours",
    description:
      "Tell us about your software project, engineering support needs or venture idea. Share who the product serves and the work you need help with.",
    url: "https://appsinhours.com/contact",
    images: ["https://appsinhours.com/appsinhours-social.png"],
  },
};
export default function Page() {
  return (
    <>

      <main id={"main"} className={"detail-main contact-v2"} tabIndex={-1}>
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
        <section id={"contact"} className={"contact"}>
          <div className={"wrap"}>
            <div className={"eyebrow"}>
              <span className={"status"} /> START A CONVERSATION
            </div>
            <div className={"contact-grid"}>
              <div className={"contact-intro detail-hero-copy"}>
                <h1>Tell us what you want to build or improve.</h1>
                <p>A few sentences about your project are enough to start.</p>
                <p className={"contact-email"}>
                  Prefer email? Write to{" "}
                  <a href={"mailto:inquiry@appsinhours.com"}>
                    inquiry@appsinhours.com
                  </a>
                  .
                </p>
                <div className={"contact-next"}>
                  <p className={"eyebrow"}>A USEFUL START</p>
                  <ol>
                    <li>
                      <span>01</span>
                      <div>
                        <strong>Share the context.</strong>
                        <p>
                          Who is it for, and what should they be able to do?
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>Discuss the scope.</strong>
                        <p>
                          Clarify the journey, constraints and the right way to
                          work together.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>Agree the next step.</strong>
                        <p>
                          Define responsibilities and terms before the work
                          begins.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
              <form id={"brief"}>
                <div className={"contact-form-heading"}>
                  <p className={"eyebrow"}>YOUR PROJECT BRIEF</p>
                  <h2>Tell us about your project.</h2>
                </div>
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
                    <option value={"Build a product"}>
                      Build a new product
                    </option>
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
                      <option value={"backend"}>
                        Backend and integrations
                      </option>
                      <option value={"improvement"}>
                        Product modernization
                      </option>
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
                    We’ll use your details to review and respond to your
                    enquiry.{" "}
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
                    <input
                      name={"website"}
                      autoComplete={"off"}
                      tabIndex={-1}
                    />
                  </label>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

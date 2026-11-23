import Link from "next/link";
export const metadata = {
  title: "Enquiry Privacy Policy | AppsInHours",
  description:
    "Read how AppsInHours handles project enquiries, saved briefs and contact details, including how to request a correction or deletion.",
  alternates: {
    canonical: "https://appsinhours.com/privacy",
  },
  openGraph: {
    title: "Enquiry Privacy Policy | AppsInHours",
    description:
      "Read how AppsInHours handles project enquiries, saved briefs and contact details, including how to request a correction or deletion.",
    url: "https://appsinhours.com/privacy",
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
        <section className={"wrap content-opening privacy-opening"}>
          <div className={"eyebrow"}>PRIVACY</div>
          <h1 data-copy={"copy-1"}>How we handle project enquiries</h1>
          <p data-copy={"privacy-v2-enquiry-intro"}>
            When you submit an enquiry, we store your contact details and
            project brief in our private studio database. We use an email
            provider to notify our team.
          </p>
        </section>
        <div className={"wrap privacy-reading"}>
          <nav className={"privacy-nav"} aria-label={"Privacy sections"}>
            <p className={"eyebrow"}>ON THIS PAGE</p>
            <a href={"#website-information"}>
              <span>01</span>Information on this website
            </a>
            <a href={"#technical-services"}>
              <span>02</span>Technical services
            </a>
            <a href={"#sending-enquiries"}>
              <span>03</span>Sending an enquiry
            </a>
          </nav>
          <div>
            <section id={"website-information"} className={"privacy-panel"}>
              <span className={"privacy-number"} aria-hidden={"true"}>
                01
              </span>
              <h2 data-copy={"copy-3"}>Information on this website</h2>
              <p data-copy={"privacy-v2-form-information"}>
                The site does not use analytics or marketing tracking cookies.
                Information entered in the enquiry form is submitted when you
                select Send enquiry and complete verification.
              </p>
            </section>
            <section id={"technical-services"} className={"privacy-panel"}>
              <span className={"privacy-number"} aria-hidden={"true"}>
                02
              </span>
              <h2 data-copy={"copy-5"}>Technical services</h2>
              <p data-copy={"copy-6"}>
                The hosting provider may process technical request information
                needed to serve and protect the website. The site requests a
                typeface from Google Fonts, which involves connecting to that
                provider.
              </p>
            </section>
            <section id={"sending-enquiries"} className={"privacy-panel"}>
              <span className={"privacy-number"} aria-hidden={"true"}>
                03
              </span>
              <h2 data-copy={"copy-7"}>Sending an enquiry</h2>
              <p data-copy={"copy-8"}>
                When sending is enabled, Cloudflare Turnstile checks the request
                for abuse and Resend processes the enquiry email. Your supplied
                contact and project information is used to review and respond to
                the enquiry. Enquiries are stored in our private studio database
                so our team can manage responses and follow-ups. Copies may also
                remain in the business mailbox and provider systems. Email
                inquiry@appsinhours.com, or reply to the studio’s response, to
                request correction or deletion. Do not include passwords or
                sensitive documents.
              </p>
            </section>
            <Link className={"primary-link"} href={"/contact#brief"}>
              Return to your project brief ↗
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

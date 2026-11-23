import ContactForm from "../../site/template/contact-form";
import { websiteTemplate as site } from "../../site/template/config";
export const metadata = { title: "Contact | " + site.name };
export default function Page() {
  return (
    <>
      <h1>{site.title}</h1>
      <p>{site.description}</p>
      <ContactForm services={site.services} email={site.email} />
    </>
  );
}

import { CustomerFrame } from "@/components/layouts/CustomerFrame";
import CustomerEnquiries from "@/features/inquiries/CustomerEnquiries";
export const metadata={title:"My enquiries | AppsInHours",referrer:"no-referrer" as const};
export default function Page(){return <CustomerFrame><CustomerEnquiries/></CustomerFrame>}

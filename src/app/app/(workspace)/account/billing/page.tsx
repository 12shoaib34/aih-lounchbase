import { CustomerBillingPage } from "@/features/admin/BillingPage";
import { CustomerFrame } from "@/components/layouts/CustomerFrame";
export const metadata = { title: "Billing | AppsInHours" };
export default function Page() {
  return (
    <CustomerFrame>
      <CustomerBillingPage />
    </CustomerFrame>
  );
}

import { NotificationsPage } from "@/features/account/NotificationsPage";
import { CustomerFrame } from "@/components/layouts/CustomerFrame";
export const metadata = { title: "Notifications | AppsInHours" };
export default function Page() {
  return (
    <CustomerFrame>
      <NotificationsPage />
    </CustomerFrame>
  );
}

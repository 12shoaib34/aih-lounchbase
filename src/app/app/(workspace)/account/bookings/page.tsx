import { BookingsPage } from "@/features/workspace/BookingsPage";
import { CustomerFrame } from "@/components/layouts/CustomerFrame";
export const metadata = { title: "Bookings | AppsInHours" };
export default function Page() {
  return (
    <CustomerFrame>
      <BookingsPage />
    </CustomerFrame>
  );
}

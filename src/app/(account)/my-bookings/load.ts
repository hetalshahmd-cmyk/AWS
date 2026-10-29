import { getCurrentUser } from "@/lib/auth";
import { manageToken } from "@/lib/booking-links";
import { patientView } from "@/lib/models";
import { listUserBookings } from "@/lib/repo";

/** The signed-in patient and their bookings, each with its signed manage link. */
export async function loadMyBookings() {
  const user = await getCurrentUser();
  if (!user) return { user: null, bookings: [] };
  const bookings = await listUserBookings(user.id, user.email);
  return {
    user,
    bookings: bookings.map((booking) => ({ ...patientView(booking), manageToken: manageToken(booking.id) })),
  };
}

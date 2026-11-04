import { redirect } from "next/navigation";

/**
 * Staff now sign in on the same page as patients (/login): a staff email
 * goes to the admin or provider panel. This address stays for old bookmarks.
 */
export default function StaffLoginPage() {
  redirect("/login");
}

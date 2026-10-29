"use client";

import { useRouter } from "next/navigation";
import BookForPatient from "./BookForPatient";

/** "Book for a patient" on server-rendered pages: reloads the numbers after. */
export default function RefreshingBookButton() {
  const router = useRouter();
  return <BookForPatient onBooked={() => router.refresh()} />;
}

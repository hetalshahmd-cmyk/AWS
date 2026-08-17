import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Create an account — ${site.name}`,
  description: "Create an account to book and manage appointments online.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-[clamp(2.5rem,6vw,4.5rem)]">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight">
        Create your account
      </h1>
      <p className="mt-2 text-plum-soft">
        You&apos;ll be signed in straight away — no need to log in again. Bookings you already made
        with this email are added automatically.
      </p>
      <Suspense fallback={null}>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}

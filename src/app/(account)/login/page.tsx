import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Log in — ${site.name}`,
  description: "Sign in to see and manage your appointments.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-[clamp(2.5rem,6vw,4.5rem)]">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight">
        Log in
      </h1>
      <p className="mt-2 text-plum-soft">
        See your upcoming visits, and cancel or reschedule in a couple of clicks.
      </p>
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </div>
  );
}

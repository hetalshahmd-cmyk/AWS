"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BTN_QUIET } from "./ui";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className={BTN_QUIET}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/session", { method: "DELETE" });
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

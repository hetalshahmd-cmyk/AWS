"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BTN_DANGER, BTN_QUIET, Notice } from "./ui";

export default function DeleteUserButton({
  id,
  name,
  bookings,
}: {
  id: string;
  name: string;
  bookings: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete this patient");
        return;
      }
      router.push("/admin/users");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button type="button" onClick={() => setConfirming(true)} className={BTN_DANGER}>
          Delete patient
        </button>
        <Notice tone="error">{error}</Notice>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-wine/30 bg-wine-soft p-4">
      <p className="text-[15px] font-semibold text-wine-deep">Delete {name}?</p>
      <p className="mt-1 text-[14px] text-plum">
        This removes the account
        {bookings > 0
          ? ` and its ${bookings} booking${bookings === 1 ? "" : "s"}, freeing any seats still held`
          : ""}
        . It can&apos;t be undone.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={remove} className={BTN_DANGER}>
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className={BTN_QUIET}
        >
          Keep patient
        </button>
      </div>
      <Notice tone="error">{error}</Notice>
    </div>
  );
}

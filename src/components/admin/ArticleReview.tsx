"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

/**
 * The doctor's decision. `hash` is the exact text on screen: if anyone edits
 * the article meanwhile, the decision is refused and the page reloads.
 */
export default function ArticleReview({ id, hash }: { id: string; hash: string }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function decide(action: "approve" | "request_changes") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/articles/${id}/workflow`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, hash, confirm: action === "approve" ? confirmed : undefined, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          setError("The article was changed while you were reading it. The page will reload with the new text.");
          setTimeout(() => router.refresh(), 2500);
        } else {
          setError(data.error ?? "Something went wrong — please try again.");
        }
        return;
      }
      setDone(action === "approve" ? "Approved — thank you." : "Sent back with your notes.");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={CARD}>
      <h2 className="text-[1rem] font-semibold">Your decision</h2>
      <label className="mt-3 flex items-start gap-2 text-[14px]">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I have read this article and it is medically accurate and appropriate for our patients.
      </label>
      <button
        type="button"
        className={`${BTN_PRIMARY} mt-3 w-full`}
        disabled={busy || !confirmed}
        onClick={() => decide("approve")}
      >
        Approve
      </button>

      <div className="mt-6 border-t border-mist pt-4">
        <label htmlFor="review-note" className={LABEL}>
          Or ask for changes
        </label>
        <textarea
          id="review-note"
          className={`${FIELD} min-h-[110px]`}
          value={note}
          maxLength={1000}
          placeholder="What needs to change, and why"
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          type="button"
          className={`${BTN_QUIET} mt-2 w-full`}
          disabled={busy || note.trim().length < 5}
          onClick={() => decide("request_changes")}
        >
          Send back with notes
        </button>
      </div>
      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{done}</Notice>
    </div>
  );
}

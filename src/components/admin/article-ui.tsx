import { STATUS_LABELS, type ArticleAction, type ArticleEvent, type ArticleStatus } from "@/lib/articles";

const STATUS_TONES: Record<ArticleStatus, string> = {
  draft: "bg-shell text-plum-soft",
  in_review: "bg-[#fdf1d8] text-[#7a5212]",
  changes_requested: "bg-wine-soft text-wine-deep",
  approved: "bg-sage-soft text-sage-ink",
};

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_TONES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** "Oct 29, 2026, 3:04 PM" in Arizona time. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const ACTION_LABELS: Record<ArticleAction, string> = {
  created: "Created",
  edited: "Edited",
  returned_to_draft: "Back to draft",
  submitted: "Sent for medical review",
  withdrawn: "Taken back from review",
  approved: "Medically approved",
  changes_requested: "Changes requested",
  published: "Published",
  unpublished: "Taken off the site",
};

/** The audit trail, newest first. */
export function HistoryList({ history }: { history: ArticleEvent[] }) {
  if (!history.length) return <p className="mt-3 text-[14px] text-plum-soft">Nothing yet.</p>;
  return (
    <ol className="mt-4 space-y-3">
      {[...history].reverse().map((item, index) => (
        <li key={`${item.at}-${index}`} className="border-l-2 border-mist pl-3 text-[14px]">
          <p>
            <strong>{ACTION_LABELS[item.action] ?? item.action}</strong> · {item.by}
            {item.role === "provider" ? " (doctor)" : ""} ·{" "}
            <span className="text-plum-soft">{formatWhen(item.at)}</span>
          </p>
          {item.note && <p className="mt-0.5 whitespace-pre-line text-plum-soft">{item.note}</p>}
          {item.hash && <p className="mt-0.5 font-mono text-[11px] text-plum-soft/80">version {item.hash.slice(0, 12)}</p>}
        </li>
      ))}
    </ol>
  );
}

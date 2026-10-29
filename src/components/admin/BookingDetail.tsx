import Link from "next/link";
import { formatLong } from "@/lib/availability";
import type { Booking } from "@/lib/models";
import { officeById, providerById } from "@/lib/scheduling";

const PREGNANT: Record<string, string> = { yes: "Yes", no: "No", "not-sure": "Not sure" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
      <dt className="text-[13px] font-semibold text-plum-soft">{label}</dt>
      <dd className="whitespace-pre-wrap text-[15px] text-plum">{value || "—"}</dd>
    </div>
  );
}

function Photo({ id, label }: { id: string | null; label: string }) {
  return (
    <figure className="rounded-xl border border-mist bg-white p-3">
      <figcaption className="text-[13px] font-semibold text-plum-soft">{label}</figcaption>
      {id ? (
        <a
          href={`/api/admin/intake-files/${id}`}
          target="_blank"
          rel="noreferrer"
          className="focus-ring mt-2 block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached admin image */}
          <img
            src={`/api/admin/intake-files/${id}`}
            alt={label}
            className="max-h-64 w-full rounded-lg bg-shell object-contain"
          />
        </a>
      ) : (
        <p className="mt-2 text-[14px] text-plum-soft">Not uploaded</p>
      )}
    </figure>
  );
}

const VIA: Record<string, string> = {
  guest: "guest (email verified)",
  staff: "staff (phone / front desk)",
  account: "patient account",
};

/**
 * One booking with the patient's pre-visit check-in — shared by the admin
 * and a provider's own panel, so both see exactly the same record.
 */
export default function BookingDetail({
  booking,
  backHref,
  backLabel,
}: {
  booking: Booking;
  backHref: string;
  backLabel: string;
}) {
  const intake = booking.intake;
  const provider = providerById(booking.providerId);
  const office = officeById(booking.officeId);
  const p = booking.patient;

  return (
    <div className="max-w-4xl">
      <Link href={backHref} className="focus-ring text-[14px] font-semibold text-wine">
        ← {backLabel}
      </Link>
      <h1 className="mt-3 font-display text-[1.9rem] font-semibold">
        {p.firstName} {p.lastName}
      </h1>
      <p className="mt-1 text-plum-soft">
        {formatLong(booking.date)} · {booking.time.toUpperCase()} ·{" "}
        {provider?.name ?? "Any provider"} · {office?.name ?? "—"} ·{" "}
        <span className={booking.status === "confirmed" ? "text-sage-ink" : "text-wine"}>
          {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}
        </span>
      </p>

      <section className="mt-6 rounded-2xl border border-mist bg-white p-6">
        <h2 className="font-display text-[1.25rem] font-semibold">Booking</h2>
        <dl className="mt-2 divide-y divide-mist">
          <Row label="Email" value={p.email} />
          <Row label="Date of birth" value={p.dob} />
          <Row label="Sex" value={p.sex} />
          {p.genderIdentity && <Row label="Gender identity" value={p.genderIdentity} />}
          {p.pronouns && <Row label="Pronouns" value={p.pronouns} />}
          <Row label="Visit reason" value={booking.reason} />
          <Row
            label="Patient type"
            value={booking.patientType === "new" ? "New patient" : "Existing patient"}
          />
          <Row
            label="Insurance"
            value={
              booking.insurance
                ? `${booking.insurance.carrier} · ${booking.insurance.plan}`
                : "Self-pay"
            }
          />
          <Row
            label="Booked"
            value={`${new Date(booking.createdAt).toLocaleString("en-US", { timeZone: "America/Phoenix" })} · ${VIA[booking.via ?? "account"] ?? VIA.account} · ${booking.lang === "es" ? "Spanish" : "English"}`}
          />
          <Row
            label="Emails"
            value={[
              booking.confirmationSentAt ? "Confirmation sent" : "No confirmation sent",
              booking.reminders?.threeDay && "3-day reminder sent",
              booking.reminders?.oneDay && "1-day reminder sent",
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-mist bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[1.25rem] font-semibold">Pre-visit check-in</h2>
          <p className="text-[14px] text-plum-soft">
            {intake?.submittedAt
              ? `Submitted ${new Date(intake.submittedAt).toLocaleString("en-US", { timeZone: "America/Phoenix" })}`
              : "Not submitted yet"}
          </p>
        </div>
        {intake?.submittedAt && (
          <>
            <dl className="mt-2 divide-y divide-mist">
              <Row label="Mobile phone" value={intake.phone} />
              <Row
                label="Address"
                value={[
                  intake.street,
                  [intake.city, intake.state, intake.zip].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join("\n")}
              />
              <Row
                label="Emergency contact"
                value={[intake.emergencyName, intake.emergencyPhone].filter(Boolean).join(" · ")}
              />
              <Row label="Member ID" value={intake.memberId} />
              <Row label="Group number" value={intake.groupNumber} />
              <Row label="Allergies" value={intake.allergies} />
              <Row label="Medications" value={intake.medications} />
              <Row label="Conditions" value={intake.conditions} />
              <Row label="Past surgeries" value={intake.surgeries} />
              <Row label="Last menstrual period" value={intake.lmp} />
              <Row label="Currently pregnant" value={PREGNANT[intake.pregnant] ?? ""} />
              <Row label="Past pregnancies" value={intake.pregnancies} />
            </dl>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {booking.insurance && (
                <>
                  <Photo id={intake.cardFrontId} label="Insurance card — front" />
                  <Photo id={intake.cardBackId} label="Insurance card — back" />
                </>
              )}
              <Photo id={intake.photoIdId} label="Photo ID" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { Band, SectionHead } from "@/components/site/ui";

export const metadata: Metadata = {
  title: `Privacy Policy — ${site.name}`,
  description:
    "How Arizona Women Specialists collects, uses and protects your information, including the cookies and advertising tools used on this website.",
  robots: { index: true, follow: true },
};

/**
 * Plain-language privacy notice. Two things make this page load-bearing rather
 * than boilerplate: it is the notice we owe visitors for the Meta pixel, and
 * it is the page the footer link points at. Keep both true if either changes.
 */

const UPDATED = "August 18, 2026";

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 font-display text-[1.45rem] font-semibold leading-tight text-plum">
      {children}
    </h2>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-3 text-[1.02rem] text-plum-soft ${className}`}>{children}</p>;
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[1.02rem] text-plum-soft">
          <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-wine" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <Band>
      <div className="max-w-[68ch]">
        <SectionHead
          eyebrow="Legal"
          title="Privacy Policy"
          body={`How we handle your information at ${site.name}.`}
        />
        <p className="-mt-5 text-[0.92rem] text-plum-soft">Last updated: {UPDATED}</p>

        <H>The short version</H>
        <P>
          We collect what we need to book your appointment and care for you, and nothing more. We
          do not sell your information. <strong className="text-plum">We never send your
          health information — including your reason for visit, date of birth, sex, or insurance
          — to Facebook, Instagram, or any other advertising company.</strong> If you would rather
          we did not use advertising cookies at all, you can decline them and the site works
          exactly the same.
        </P>

        <H>Who we are</H>
        <P>
          {site.name} operates this website and the clinics at 4700 N 51st Ave, Ste 5, Phoenix, AZ
          85031 and 6370 W Union Hills Dr, Glendale, AZ 85308. You can reach us on{" "}
          <a href={site.phoneHref} className="font-semibold text-wine link-underline">
            {site.phone}
          </a>{" "}
          or through our <Link href="/contact" className="font-semibold text-wine link-underline">
            contact page
          </Link>.
        </P>

        <H>What we collect</H>
        <P>When you create an account or book an appointment, we ask for:</P>
        <List
          items={[
            "Your name and email address, so we can create your account and confirm your booking.",
            "A one-time code sent to your email, to verify the address belongs to you.",
            "Your date of birth and sex, which the office needs to identify you correctly in your medical record.",
            "Your reason for visit and insurance details, so the right amount of time and the right coverage are ready when you arrive.",
          ]}
        />
        <P>
          We also record basic technical information every website records — your IP address,
          browser type, and which pages you opened. This is used to keep the site running and
          secure.
        </P>

        <H>How we use it</H>
        <List
          items={[
            "To schedule, confirm, change and cancel your appointments.",
            "To verify your email address and keep your account secure.",
            "To provide medical care and maintain your records, as any clinic does.",
            "To understand, in aggregate, how many people find and use the website.",
          ]}
        />
        <P>We do not sell your personal information, and we do not rent or trade it.</P>

        <H>Cookies and similar technologies</H>
        <P>This website uses a small number of cookies. They fall into two groups.</P>

        <h3 className="mt-6 font-display text-[1.15rem] font-semibold text-plum">
          Necessary cookies — always on
        </h3>
        <P>
          These keep you signed in and keep the site secure. The site cannot work without them, so
          they are not optional. They are set by us, not by anyone else.
        </P>

        <h3 className="mt-6 font-display text-[1.15rem] font-semibold text-plum">
          Advertising cookies — only with your permission
        </h3>
        <P>
          We advertise our services on Facebook and Instagram. To understand whether those ads
          actually help people find care, we use the{" "}
          <strong className="text-plum">Meta Pixel and Meta Conversions API</strong>, provided by
          Meta Platforms, Inc.
        </P>
        <P>These place or read the following cookies:</P>
        <List
          items={[
            <>
              <code className="rounded bg-shell px-1.5 py-0.5 text-[0.9em]">_fbp</code> — set by
              Meta to recognise the same browser across visits.
            </>,
            <>
              <code className="rounded bg-shell px-1.5 py-0.5 text-[0.9em]">_fbc</code> — records
              that you arrived from a Facebook or Instagram ad.
            </>,
            <>
              <code className="rounded bg-shell px-1.5 py-0.5 text-[0.9em]">awsp_fbclid</code> — our
              own cookie, holding the click identifier from an ad link so it is not lost while you
              browse. It is only shared with Meta if you have accepted advertising cookies.
            </>,
          ]}
        />
        <P>
          <strong className="text-plum">Nothing loads until you choose.</strong> When you first
          visit, you are asked whether to allow advertising cookies. If you decline, or simply
          ignore the banner, no Meta script ever loads and no advertising cookie is set.
        </P>

        <H>What we send to Meta — and what we never send</H>
        <P>
          If you accept advertising cookies, we tell Meta that an anonymous visitor viewed a page,
          started an appointment booking, or completed one. That is the whole picture.
        </P>
        <P className="font-semibold">We never send Meta:</P>
        <List
          items={[
            "Your name, email address or phone number.",
            "Your date of birth or sex.",
            "Your reason for visit, or any medical condition, symptom, test or service.",
            "Your insurance carrier or plan.",
            "Any account identifier that could be traced back to you.",
          ]}
        />
        <P>
          We have also configured our advertising account so that Meta&apos;s automatic collection
          of form fields is switched off, and we apply Meta&apos;s Limited Data Use flag to every
          event we send.
        </P>
        <P>
          Meta is not a business associate of this practice and has not signed a business associate
          agreement. That is precisely why no protected health information is ever shared with
          them. You can read{" "}
          <a
            href="https://www.facebook.com/privacy/policy"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-wine link-underline"
          >
            Meta&apos;s own privacy policy
          </a>{" "}
          for how they handle the data they do receive.
        </P>

        <H>Your choices</H>
        <List
          items={[
            "Decline advertising cookies on the banner, and nothing is loaded or sent.",
            "Change your mind at any time by clearing this site's cookies in your browser, which brings the banner back.",
            "Use your browser's Do Not Track or tracking-prevention settings — we honour them.",
            "Book by phone instead. Calling us involves no website tracking of any kind.",
          ]}
        />
        <P>
          Depending on where you live, you may have additional rights to see, correct, or delete
          the information we hold about you. Contact us and we will help.
        </P>

        <H>Your medical records</H>
        <P>
          Information held in your medical record is protected separately under HIPAA and Arizona
          law, and is governed by our Notice of Privacy Practices, which you receive at your visit.
          Nothing in this website policy reduces those protections.
        </P>

        <H>How long we keep things</H>
        <P>
          Account and booking records are kept for as long as you are a patient and for the period
          required by Arizona medical record retention rules. Website cookies expire on their own —
          the advertising cookies described above last no longer than 90 days.
        </P>

        <H>Children</H>
        <P>
          This website is not directed at children under 13, and we do not knowingly collect their
          information online. Our advertising is directed only at adults aged 18 and over.
        </P>

        <H>Changes to this policy</H>
        <P>
          If we change how we use information, we will update this page and change the date at the
          top. If the change is significant, we will make it obvious rather than quiet.
        </P>

        <H>Contact us</H>
        <P>
          Questions about this policy, or about the information we hold on you? Call{" "}
          <a href={site.phoneHref} className="font-semibold text-wine link-underline">
            {site.phone}
          </a>{" "}
          or visit either office. We would rather answer than have you wonder.
        </P>
      </div>
    </Band>
  );
}

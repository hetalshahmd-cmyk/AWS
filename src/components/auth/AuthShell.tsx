import Image from "next/image";
import { photos } from "@/lib/photos";
import { site } from "@/lib/site";

/**
 * Two columns on wide screens — the form beside a photograph. On phones the
 * photo is dropped entirely so the form is the first thing on screen.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ivory">
      <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-[clamp(20px,5vw,48px)] py-[clamp(2.5rem,6vw,4.5rem)] min-[960px]:grid-cols-[1fr_1fr] min-[960px]:items-stretch min-[960px]:gap-16">
        <div className="mx-auto w-full max-w-md self-center">{children}</div>

        <div className="relative hidden min-h-[560px] overflow-hidden rounded-[28px] bg-sand min-[960px]:block">
          <Image
            src={photos.clinicConsultWide.src}
            alt=""
            fill
            sizes="50vw"
            placeholder="blur"
            className="object-cover object-[50%_60%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,22,25,0)_45%,rgba(29,22,25,.75)_100%)]"
          />
          <p className="absolute inset-x-8 bottom-8 font-display text-[1.6rem] leading-snug text-white">
            {site.footerBlurb}
          </p>
        </div>
      </div>
    </div>
  );
}

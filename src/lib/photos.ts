import bookingPhone from "@/assets/photos/booking-phone.jpg";
import clinicConsultWide from "@/assets/photos/clinic-consult-wide.jpg";
import consultTablet from "@/assets/photos/consult-tablet.jpg";
import firstTrimester from "@/assets/photos/first-trimester.jpg";
import heroConsultation from "@/assets/photos/hero-consultation.jpg";
import heroPregnancy from "@/assets/photos/hero-pregnancy.jpg";
import heroUltrasound from "@/assets/photos/hero-ultrasound.jpg";
import hetalShah from "@/assets/providers/hetal-shah.jpg";
import julieDenton from "@/assets/providers/julie-denton.jpg";
import kyleeTate from "@/assets/providers/kylee-tate.jpg";
import phoenixAerial from "@/assets/photos/phoenix-aerial.jpg";
import pregnancyHands from "@/assets/photos/pregnancy-hands.jpg";
import pregnancyTest from "@/assets/photos/pregnancy-test.jpg";
import prenatalUltrasound from "@/assets/photos/prenatal-ultrasound.jpg";
import receptionDesk from "@/assets/photos/reception-desk.jpg";
import receptionTablet from "@/assets/photos/reception-tablet.jpg";
import saguaroSunset from "@/assets/photos/saguaro-sunset.jpg";
import stethoscope from "@/assets/photos/stethoscope.jpg";
import superstition from "@/assets/photos/superstition.jpg";
import teenSupport from "@/assets/photos/teen-support.jpg";
import ultrasoundCloseup from "@/assets/photos/ultrasound-closeup.jpg";
import ultrasoundScan from "@/assets/photos/ultrasound-scan.jpg";
import ultrasoundScreen from "@/assets/photos/ultrasound-screen.jpg";
import valleyView from "@/assets/photos/valley-view.jpg";

/**
 * Every photograph on the public site, in one place.
 *
 * These are licensed stock photographs (Pexels and Unsplash licences: free for
 * commercial use, no attribution required), chosen from one consistent shoot
 * where possible. They illustrate the kind of care offered — they are NOT the
 * practice's own staff or offices, so they are never captioned or placed as if
 * they were. When real photography of the team and clinics exists, swap it in
 * here and every page picks it up.
 *
 * Sources:
 *   heroConsultation, consultTablet, clinicConsultWide, pregnancyHands,
 *   prenatalUltrasound, ultrasoundScan, ultrasoundScreen, heroUltrasound —
 *     Pexels (OB-GYN clinic series). heroUltrasound: a clinic name badge was
 *     retouched out.
 *   firstTrimester, ultrasoundCloseup — Pexels (same clinic series).
 *   pregnancyTest, teenSupport, receptionDesk, receptionTablet, bookingPhone — Pexels.
 *   heroPregnancy (mirrored), stethoscope, phoenixAerial, saguaroSunset,
 *   valleyView, superstition — Unsplash.
 */
export const photos = {
  heroConsultation: {
    src: heroConsultation,
    alt: "A physician going over results on a tablet with a patient in a bright exam room",
  },
  heroUltrasound: {
    src: heroUltrasound,
    alt: "A smiling clinician performing a prenatal ultrasound for an expectant mother",
  },
  heroPregnancy: {
    src: heroPregnancy,
    alt: "An expectant mother cradling her belly in soft window light",
  },
  consultTablet: {
    src: consultTablet,
    alt: "A physician explaining next steps to a patient during a consultation",
  },
  clinicConsultWide: {
    src: clinicConsultWide,
    alt: "A clinician and a patient talking together in a calm, sunlit exam room",
  },
  pregnancyHands: {
    src: pregnancyHands,
    alt: "An expectant mother resting her hands on her belly during a visit",
  },
  prenatalUltrasound: {
    src: prenatalUltrasound,
    alt: "A clinician gently performing an obstetric ultrasound",
  },
  ultrasoundScan: {
    src: ultrasoundScan,
    alt: "An ultrasound scan in progress, with the image on the monitor",
  },
  ultrasoundScreen: {
    src: ultrasoundScreen,
    alt: "A clinician reviewing an ultrasound image on screen",
  },
  stethoscope: {
    src: stethoscope,
    alt: "A burgundy stethoscope resting on a white surface",
  },
  phoenixAerial: {
    src: phoenixAerial,
    alt: "The Phoenix valley at golden hour, with Camelback Mountain in the distance",
  },
  saguaroSunset: {
    src: saguaroSunset,
    alt: "A saguaro cactus silhouetted against an Arizona desert sunset",
  },
  firstTrimester: {
    src: firstTrimester,
    alt: "An expectant mother resting her hands on her belly while a clinician takes notes",
  },
  ultrasoundCloseup: {
    src: ultrasoundCloseup,
    alt: "A close view of an abdominal ultrasound in progress",
  },
  pregnancyTest: {
    src: pregnancyTest,
    alt: "A pregnancy test resting on a soft cream surface",
  },
  teenSupport: {
    src: teenSupport,
    alt: "Two young women holding a pregnancy test together",
  },
  receptionDesk: {
    src: receptionDesk,
    alt: "A friendly receptionist welcoming a patient at a clinic front desk",
  },
  receptionTablet: {
    src: receptionTablet,
    alt: "A front-desk team member checking details on a tablet",
  },
  bookingPhone: {
    src: bookingPhone,
    alt: "A smiling young woman booking an appointment on her phone at home",
  },
  valleyView: {
    src: valleyView,
    alt: "A saguaro on a ridge above the Phoenix valley at dusk",
  },
  superstition: {
    src: superstition,
    alt: "Saguaros and desert brush glowing at sunset below Arizona mountains",
  },
} as const;

export type PhotoKey = keyof typeof photos;

/**
 * The practice's own provider headshots, as shown on their Zocdoc profiles
 * (140px originals supplied by the practice — small, so they are only ever
 * shown at avatar sizes). Replace with full-resolution originals when
 * available; the keys are referenced from `providers` in lib/site.ts.
 */
export const providerPhotos = {
  hetalShah,
  julieDenton,
  kyleeTate,
} as const;

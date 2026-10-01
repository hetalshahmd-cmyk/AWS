import clinicConsultWide from "@/assets/photos/clinic-consult-wide.jpg";
import consultTablet from "@/assets/photos/consult-tablet.jpg";
import heroConsultation from "@/assets/photos/hero-consultation.jpg";
import heroPregnancy from "@/assets/photos/hero-pregnancy.jpg";
import heroUltrasound from "@/assets/photos/hero-ultrasound.jpg";
import phoenixAerial from "@/assets/photos/phoenix-aerial.jpg";
import pregnancyHands from "@/assets/photos/pregnancy-hands.jpg";
import prenatalUltrasound from "@/assets/photos/prenatal-ultrasound.jpg";
import saguaroSunset from "@/assets/photos/saguaro-sunset.jpg";
import stethoscope from "@/assets/photos/stethoscope.jpg";
import ultrasoundScan from "@/assets/photos/ultrasound-scan.jpg";
import ultrasoundScreen from "@/assets/photos/ultrasound-screen.jpg";

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
 *   heroPregnancy (mirrored), stethoscope, phoenixAerial, saguaroSunset — Unsplash.
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
} as const;

export type PhotoKey = keyof typeof photos;

export const practice = {
  name: "Arizona Women's Specialists",
  specialty: "Gynecologist",
  addressLine: "4700 N 51st Ave, Ste 5, Phoenix, AZ",
  addressFull: "4700 N 51st Ave, Ste 5, Phoenix, AZ 85031",
  address: {
    street: "4700 N 51st Ave, Ste 5",
    city: "Phoenix",
    state: "AZ",
    zip: "85031",
  },
  phone: "(623) 846-7597",
  timezone: "MST",
  mapsQuery: "4700 N 51st Ave Ste 5, Phoenix, AZ 85031",
  photoAlt: "Arizona Women's Specialists logo",
  bookingPartner: "The office partners with Arizona to schedule appointments",
  /** First paragraph shows collapsed; "show more" reveals the rest. */
  bio: [
    "Arizona Women's Specialists is a highly skilled gynecology practice. The team sees patients at their office in Phoenix, AZ.",
    "As part of their formal education and training, the physicians at Arizona Women's Specialists completed medical degrees at the University of Arizona, Tucson, and residencies at Banner - University Medical Center, Phoenix. They are certified by the American Board of Obstetrics and Gynecology.",
    "The team is fluent in English and Spanish, which allows them to serve patients from diverse linguistic backgrounds. During consultations, they listen to patients, explain their conditions, and develop personalized treatment plans tailored to their needs, goals, and preferences.",
  ],
} as const;

/** Grouped exactly like the visit-reason dropdown on the booking flow. */
export const visitReasons = {
  popular: [
    "OB-GYN Consultation",
    "OB-GYN Follow Up",
    "Pregnancy Test",
    "Prenatal Care",
    "Ultrasound",
  ],
  all: [
    "Confirmation of Pregnancy",
    "First Trimester Screening",
    "Missed Periods",
    "Prenatal Care - First Trimester",
    "Recurrent Pregnancy Loss",
    "Annual Well-Woman Exam",
    "Birth Control Consultation",
    "IUD Insertion or Removal",
    "Menopause Consultation",
    "Pap Smear",
    "Pelvic Pain",
    "Infertility Consultation",
    "Postpartum Visit",
    "STD Testing",
    "Vaginal Discharge or Itching",
  ],
} as const;

export const defaultVisitReason = visitReasons.popular[0];

export const highlights = [
  {
    icon: "calendar" as const,
    title: "New patient appointments",
    body: "Appointments available for new patients on Arizona",
  },
  {
    icon: "shield" as const,
    title: "In-network insurances",
    body: "Aetna, BlueCross BlueShield, Cigna, Medicare, UnitedHealthcare",
    action: "insurance" as const,
    actionLabel: "(200+) more in-network plans",
  },
  {
    icon: "clock" as const,
    title: "Short wait times",
    body: "Patients are typically seen within 15 minutes of their scheduled time",
  },
  {
    icon: "globe" as const,
    title: "Languages spoken",
    body: "English, Spanish, Gujarati, and Hindi are spoken in the office",
  },
];

export type Carrier = {
  name: string;
  /** Text shown inside the logo tile — stand-in for the carrier mark. */
  short: string;
  color: string;
  popular?: boolean;
};

export const carriers: Carrier[] = [
  { name: "1199SEIU National Benefit Fund", short: "1199", color: "#1b4f9c" },
  { name: "6 Degrees Health", short: "6DH", color: "#0f766e" },
  { name: "Aetna", short: "aetna", color: "#7d3f98", popular: true },
  { name: "AHCCCS", short: "AHC", color: "#1f6f4a" },
  { name: "Ambetter from Arizona Complete Health", short: "AMB", color: "#5b2d90" },
  { name: "Anthem Blue Cross Blue Shield", short: "Anthem", color: "#005eb8", popular: true },
  { name: "Banner University Family Care", short: "BUFC", color: "#00427e" },
  { name: "Beech Street", short: "BS", color: "#4a5568" },
  { name: "Blue Cross Blue Shield of Arizona", short: "BCBS", color: "#0067b1", popular: true },
  { name: "Bright HealthCare", short: "Bright", color: "#e0592a" },
  { name: "CareFirst", short: "CF", color: "#0071ce" },
  { name: "ChoiceCare Network", short: "CCN", color: "#146c43" },
  { name: "Cigna", short: "Cigna", color: "#e35205", popular: true },
  { name: "Coventry Health Care", short: "CHC", color: "#8b1f41" },
  { name: "Devoted Health", short: "DH", color: "#2b6cb0" },
  { name: "Emblem Health", short: "EH", color: "#00857d" },
  { name: "First Health Network", short: "FHN", color: "#1b4f9c" },
  { name: "Freedom Life", short: "FL", color: "#4a5568" },
  { name: "GEHA", short: "GEHA", color: "#0b5cab" },
  { name: "Golden Rule", short: "GR", color: "#b8860b" },
  { name: "Health Choice Arizona", short: "HCA", color: "#1f6f4a" },
  { name: "Health Net", short: "HN", color: "#0067b1" },
  { name: "Humana", short: "Humana", color: "#5c8727" },
  { name: "Magellan Health", short: "MH", color: "#00549f" },
  { name: "Medicare", short: "Medicare", color: "#0b5cab", popular: true },
  { name: "Mercy Care", short: "Mercy", color: "#12100c", popular: true },
  { name: "Molina Healthcare", short: "Molina", color: "#00a1a1" },
  { name: "MultiPlan", short: "MP", color: "#003b71" },
  { name: "Nippon Life Benefits", short: "NLB", color: "#a51c30" },
  { name: "Oscar Health", short: "Oscar", color: "#0f4c81" },
  { name: "Oxford Health Plans", short: "OHP", color: "#1b4f9c" },
  { name: "PHCS Network", short: "PHCS", color: "#003b71" },
  { name: "Premera Blue Cross", short: "PBC", color: "#0067b1" },
  { name: "Sana Benefits", short: "Sana", color: "#2f855a" },
  { name: "SelectHealth", short: "SH", color: "#00857d" },
  { name: "TRICARE For Life", short: "TFL", color: "#1b4f9c" },
  { name: "Tricare West", short: "TW", color: "#1b4f9c" },
  { name: "UMR", short: "UMR", color: "#1c4f9c" },
  { name: "UnitedHealthcare", short: "UHC", color: "#1c4f9c", popular: true },
  { name: "US Health Group", short: "USHG", color: "#4a5568" },
  { name: "WellCare", short: "WC", color: "#00579c" },
  { name: "Wellpoint", short: "WP", color: "#005eb8" },
];

const CARRIER_PLANS: Record<string, string[]> = {
  Aetna: [
    "Choice POS II",
    "Managed Choice POS (Open Access)",
    "Open Access Elect Choice EPO",
    "Signature Administrators PPO",
  ],
  "Blue Cross Blue Shield of Arizona": [
    "Blue Card PPO",
    "Alliance HMO",
    "Blue Choice PPO",
    "Blue Advantage HMO",
  ],
  Cigna: ["Open Access Plus", "PPO", "LocalPlus", "SureFit"],
  UnitedHealthcare: ["Choice Plus POS", "Options PPO", "Navigate HMO", "Charter Balanced"],
  Medicare: ["Medicare Part B", "Medicare Advantage"],
  "Mercy Care": ["Mercy Care Complete Care", "Mercy Care Advantage", "Mercy Care DDD"],
  "Anthem Blue Cross Blue Shield": ["Blue Access PPO", "Pathway HMO", "National PPO (BlueCard)"],
  Humana: ["ChoiceCare Network PPO", "National POS", "Gold Plus HMO"],
  AHCCCS: ["Health Choice Arizona", "Mercy Care", "Banner University Family Care"],
};

const DEFAULT_PLANS = ["PPO", "HMO", "POS", "EPO"];

export function plansFor(carrier: string): string[] {
  return CARRIER_PLANS[carrier] ?? DEFAULT_PLANS;
}

export const officeHours = [
  { day: "Monday", hours: "8:00 am – 5:00 pm" },
  { day: "Tuesday", hours: "8:00 am – 5:00 pm" },
  { day: "Wednesday", hours: "8:00 am – 5:00 pm" },
  { day: "Thursday", hours: "8:00 am – 5:00 pm" },
  { day: "Friday", hours: "8:00 am – 2:00 pm" },
  { day: "Saturday", hours: "Closed" },
  { day: "Sunday", hours: "Closed" },
];

export const site = {
  name: "Arizona Women Specialists",
  tagline: "Gynecology & Women's Care",
  phone: "(623) 846-7597",
  phoneHref: "tel:+16238467597",
  /**
   * Where every "Book Now" CTA sends people: the provider cards on the
   * Providers page, where each provider's Book opens the booking form in
   * place. `/about#book-tate` (or `#book-tate-arrowhead`) opens it for Kylee
   * straight away.
   */
  bookCta: "/about#providers",
  /**
   * The stand-alone booking page — still used for "Reschedule" links, which
   * carry the appointment being moved. The practice's Zocdoc page, if it is
   * ever needed again:
   * https://www.zocdoc.com/booking-link/practice/arizona-womens-specialists-180158
   */
  bookingUrl: "/book",
  announce: {
    strong: "FREE pregnancy test",
    rest: "Walk in today · Phoenix & Glendale",
  },
  description:
    "Compassionate, confidential care from Dr. Hetal C. Shah, MD. Walk-ins welcome, AHCCCS & WIC accepted — and you can book online in under a minute.",
  footerBlurb: "Compassionate pregnancy and women's health care in Phoenix & Glendale.",
};

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "Providers" },
  { href: "/contact", label: "Contact" },
];

export const heroChips = [
  "Same-day appointments",
  "Walk-ins welcome",
  "Most insurances accepted",
  "AHCCCS & WIC accepted",
  "Se habla español",
  "100% confidential",
];

export const quickLinks = [
  {
    href: "/services",
    icon: "heart" as const,
    title: "Our Services",
    body: "Testing, ultrasound & prenatal care",
  },
  {
    href: "/pricing",
    icon: "tag" as const,
    title: "Pricing",
    body: "$100 first visit · $75 follow-up",
  },
  {
    href: "/contact",
    icon: "pin" as const,
    title: "Visit Us",
    body: "Phoenix & Glendale offices",
  },
];

export const services = [
  {
    icon: "droplet" as const,
    title: "Pregnancy Testing",
    body: "Fast, private confirmation with same-day results and clear next steps.",
  },
  {
    icon: "waves" as const,
    title: "Ultrasound",
    body: "Same-day and walk-in ultrasounds to confirm and check on your baby.",
  },
  {
    icon: "heart" as const,
    title: "First-Trimester Care",
    body: "Early prenatal visits to start your pregnancy on a healthy path.",
  },
  {
    icon: "pulse" as const,
    title: "Prenatal Care",
    body: "Ongoing monitoring and support through every trimester.",
  },
  {
    icon: "users" as const,
    title: "Teen Pregnancy Support",
    body: "Kind, confidential guidance and care with zero judgment.",
  },
  {
    icon: "tag" as const,
    title: "Insurance & AHCCCS",
    body: "We accept most major insurance plans, AHCCCS & WIC — and help you use your benefits.",
  },
];

export const steps = [
  {
    icon: "cal" as const,
    title: "Book online",
    body: "Pick a time on our secure booking page in under a minute — or call us.",
  },
  {
    icon: "pin" as const,
    title: "Come in",
    body: "Two convenient locations in Phoenix and Glendale. Walk-ins welcome.",
  },
  {
    icon: "heart" as const,
    title: "Get care",
    body: "Compassionate, expert care with a clear plan and clear pricing.",
  },
];

export const faqs = [
  {
    q: "Do I need an appointment, or can I walk in?",
    a: "Both work. Book online in under a minute for a guaranteed time, or simply walk in — we welcome walk-ins at both locations and offer same-day appointments whenever possible.",
  },
  {
    q: "What insurance do you accept?",
    a: "Most major insurance plans — plus AHCCCS, Medicare, WIC and workers' comp. Don't see your plan? Call (623) 846-7597 — chances are we accept it.",
  },
  {
    q: "Can I get a same-day ultrasound?",
    a: "Often, yes — same-day and walk-in ultrasounds are available subject to availability. Booking online or calling ahead is the fastest way to be seen the same day.",
  },
  {
    q: "Is my visit confidential?",
    a: "Completely. Every visit is 100% private and judgment-free — including care for teens.",
  },
];

export const prices = [
  {
    tag: "New Patient",
    tagIcon: "star" as const,
    amount: "$100",
    title: "New Patient Visit",
    body: "Comprehensive initial consultation and exam.",
  },
  {
    tag: "Returning",
    tagIcon: "check" as const,
    amount: "$75",
    title: "Established Patient Visit",
    body: "Follow-up care and routine monitoring.",
  },
  {
    tag: "Imaging",
    tagIcon: "waves" as const,
    amount: "$75",
    title: "Ultrasound",
    body: "OB & GYN ultrasounds.",
  },
  {
    tag: "Birth Control",
    tagIcon: "shield" as const,
    amount: "$50",
    title: "Depo Shot",
    body: "Contraceptive injection.",
  },
  {
    tag: "Birth Control",
    tagIcon: "shield" as const,
    amount: "$150",
    title: "IUD Insertion",
    body: "Mirena, Paragard, Liletta, Kyleena & more.",
  },
  {
    tag: "Birth Control",
    tagIcon: "shield" as const,
    amount: "$100",
    title: "IUD Removal",
    body: "All IUDs, Nexplanon & more.",
  },
];

/**
 * Each provider as their Zocdoc listing shows them (checked Oct 6, 2026):
 * name, title, rating, review count, education, certification, NPI and the
 * visits patients book most. Ratings and counts change — re-check now and then.
 * Dr. Shah's listing has no reviews yet, so it shows no rating.
 *
 * `ecwUrl` is the provider's eClinicalWorks / healow booking page, behind
 * the "eCW" button beside "Zocdoc" in their profile. While it is null the
 * button shows the office phone instead (no public healow page was found).
 *
 * `id` is what slots and bookings store — never change it once bookings exist.
 * `photo` keys into providerPhotos (lib/photos.ts).
 */
/**
 * The starting list only: providers now live in MongoDB and are edited from
 * Admin → Doctors (see lib/providers.ts). This seeds an empty collection.
 */
export const seedProviders = [
  {
    id: "shah",
    initials: "HS",
    photo: "hetalShah",
    name: "Dr. Hetalkumar Shah, MD",
    cred: "Gynecologist",
    languages: ["English", "Hindi", "Spanish"],
    zocdocRating: null,
    zocdocReviews: null,
    zocdocUrl: "https://www.zocdoc.com/doctor/hetalkumar-shah-md-808675",
    ecwUrl: null as string | null,
    npi: "1750363255",
    about: [
      "Dr. Hetalkumar (Hetal) Shah is an OB-GYN at Arizona Women's Specialists, caring for women at every stage — from first visits and pregnancy to menopause.",
      "He earned his medical degree at the University of Arizona in Tucson and completed his residency at Banner – University Medical Center Phoenix. He is certified by the American Board of Obstetrics and Gynecology.",
      "In each visit he listens first, explains the condition clearly, and builds a treatment plan around the patient's own needs, goals and preferences.",
    ],
    education: [
      "University of Arizona, Tucson — Doctor of Medicine (MD)",
      "Banner – University Medical Center Phoenix — Residency",
    ],
    certifications: ["American Board of Obstetrics and Gynecology"],
    focus: [
      "Birth control",
      "Pregnancy confirmation",
      "Gynecology consultation",
      "Natural family planning",
      "Genetic counseling / pregnancy screening",
      "Weight loss consultation",
    ],
    cta: "Book with Dr. Shah",
    avatar: "from-[#9C3E55] to-[#5C1E2D]",
  },
  {
    id: "denton",
    initials: "JD",
    photo: "julieDenton",
    name: "Julie Denton, NP",
    cred: "Nurse Practitioner (OB-GYN)",
    languages: ["English", "Spanish"],
    zocdocRating: 5.0,
    zocdocReviews: 6,
    zocdocUrl: "https://www.zocdoc.com/doctor/julie-denton-np-808676",
    ecwUrl: null as string | null,
    npi: "1942679188",
    about: [
      "Julie Denton is an experienced family nurse practitioner who sees patients at Arizona Women's Specialists in Phoenix and Glendale. She speaks English and Spanish.",
      "She explains each patient's condition clearly and builds a treatment plan around them — prescriptions when needed, plus practical lifestyle, exercise and diet advice. She puts preventive care first, schedules follow-ups and refers to specialists when that's the right next step.",
    ],
    education: [
      "Walden University — Master's in Nursing",
      "University of Phoenix — Bachelor's degree",
    ],
    certifications: [],
    focus: [
      "Annual Pap smear / GYN exam",
      "Birth control",
      "Pregnancy confirmation",
      "Prenatal care",
      "Ultrasound",
      "STI testing",
    ],
    cta: "Book with Julie",
    avatar: "from-[#6E9E95] to-[#4E7B73]",
  },
  {
    id: "tate",
    initials: "KT",
    photo: "kyleeTate",
    name: "Kylee Tate, PA-C",
    cred: "Physician Assistant (OB-GYN)",
    languages: ["English", "Spanish"],
    zocdocRating: 4.93,
    zocdocReviews: 15,
    zocdocUrl: "https://www.zocdoc.com/doctor/kylee-tate-pa-c-808720",
    ecwUrl: null as string | null,
    npi: "1306557913",
    about: [
      "Kylee Tate is a physician assistant specializing in OB-GYN, seeing patients at Arizona Women's Specialists in Phoenix and Glendale. She speaks English and Spanish.",
      "She supports patients through routine gynecologic care, preventive screenings and reproductive health visits, and is known for taking the time to explain care options clearly in a supportive, respectful setting.",
    ],
    education: [
      "North Greenville University — Master's in Physician Assistant Studies",
      "Saint Louis University — Bachelor's degree",
    ],
    certifications: ["National Commission on Certification of Physician Assistants"],
    focus: [
      "Annual Pap smear / GYN exam",
      "Birth control",
      "Breast pain",
      "Pregnancy confirmation",
      "Early prenatal care",
      "Vaginal discharge / infection",
    ],
    cta: "Book with Kylee",
    avatar: "from-[#7C2C3E] to-[#4E7B73]",
  },
  {
    // Zocdoc profile + NPI registry (practice address: 6370 W Union Hills Dr).
    // No headshot supplied yet — upload one in Admin → Doctors.
    id: "erickson",
    initials: "ME",
    photo: null,
    name: "Dr. Marvin Erickson, MD",
    cred: "OB-GYN",
    languages: ["English", "Spanish"],
    zocdocRating: 4.75,
    zocdocReviews: 202,
    zocdocUrl: "https://www.zocdoc.com/doctor/marvin-erickson-md-243428",
    ecwUrl: null as string | null,
    npi: "1679569776",
    about: [
      "Dr. Marvin Erickson is an obstetrician-gynecologist with about 30 years of experience, seeing patients at Arizona Women's Specialists in Glendale. He speaks English and Spanish.",
      "He cares for women through pregnancy — including high-risk pregnancies and complications such as preeclampsia and gestational diabetes — as well as everyday gynecologic care.",
    ],
    education: [
      "University of Arizona College of Medicine — Doctor of Medicine (MD), 1996",
      "Maricopa Integrated Health System — Residency in Obstetrics & Gynecology",
    ],
    certifications: [],
    focus: [
      "Prenatal care",
      "High-risk pregnancy",
      "Pregnancy complications",
      "Gynecology consultation",
    ],
    cta: "Book with Dr. Erickson",
    avatar: "from-[#4E7B73] to-[#2F4F48]",
  },
  {
    // Zocdoc profile + NPI registry (practice address: 6370 W Union Hills Dr).
    id: "cook",
    initials: "MC",
    photo: null,
    name: "Dr. Mitchell Cook, DO",
    cred: "OB-GYN",
    languages: ["English"],
    zocdocRating: 5.0,
    zocdocReviews: 2,
    zocdocUrl: "https://www.zocdoc.com/doctor/mitchell-cook-do-829459",
    ecwUrl: null as string | null,
    npi: "1245973601",
    about: [
      "Dr. Mitchell Cook is an obstetrician-gynecologist seeing patients at Arizona Women's Specialists in Glendale. He is originally from a small town in Alberta, Canada.",
      "He earned his medical degree at Midwestern University–Arizona College of Osteopathic Medicine in Glendale and completed his residency in Obstetrics and Gynecology at the University of Tennessee Health Science Center in Memphis.",
    ],
    education: [
      "Midwestern University – Arizona College of Osteopathic Medicine — Doctor of Osteopathic Medicine (DO)",
      "University of Tennessee Health Science Center, Memphis — Residency in Obstetrics & Gynecology",
    ],
    certifications: [],
    focus: [],
    cta: "Book with Dr. Cook",
    avatar: "from-[#8A6A9E] to-[#5C3E70]",
  },
] as const;

export const providerCreds = [
  "Board-Certified OB-GYN care",
  "Same-day & walk-in visits",
  "AHCCCS & WIC friendly",
  "Compassionate & confidential",
];

/**
 * `id` is what slots and bookings store; `area` is the name the front desk
 * uses (Maryvale, Arrowhead). Never change an `id` once bookings exist.
 */
export const locations = [
  {
    id: "maryvale",
    area: "Maryvale",
    name: "Phoenix Office",
    address: ["4700 N 51st Ave, Suite 5", "Phoenix, AZ 85031"],
    maps:
      "https://www.google.com/maps/search/?api=1&query=4700+N+51st+Ave+Suite+5+Phoenix+AZ+85031",
  },
  {
    id: "arrowhead",
    area: "Arrowhead",
    name: "Glendale Office",
    address: ["6370 W Union Hills Dr", "Glendale, AZ 85308"],
    maps:
      "https://www.google.com/maps/search/?api=1&query=6370+W+Union+Hills+Dr+Glendale+AZ+85308",
  },
] as const;


export const insurancePills = [
  "AHCCCS",
  "Medicare",
  "Molina",
  "Health Choice",
  "Imperial",
  "UPMC",
  "HealthSmart",
  "Multiplan",
  "Prime Health",
  "Provider Network of America",
];

export const insurancePlans = [
  "ACPN - PPO",
  "AmeriPlan Discount Card",
  "Antidote PPO",
  "CorVel Auto",
  "CorVel PPO",
  "CorVel Workers Comp",
  "Fusion PPO",
  "Galaxy Health PPO",
  "Galaxy Health Savings Card - Discount",
  "Galaxy Health Workers Comp",
  "Gold Kidney Health Plan - Discount",
  "Health Choice - AHCCCS",
  "Health Choice - Generations Medicare",
  "HealthSmart ACCEL - IME",
  "HealthSmart Auto",
  "HealthSmart HPO - AP",
  "HealthSmart PPO",
  "HealthSmart Workers Comp",
  "IHP - Claritev Auto",
  "IHP - Claritev Discount Card",
  "IHP - Claritev PPO",
  "IHP - Claritev Workers Comp",
  "Imperial - HealthCosmos Medical Group - EPO",
  "Imperial - Marketplace Plan - Discount",
  "Imperial - Medicare",
  "Imperial - Wellpoint - IME",
  "MCCP - Auto",
  "MCCP - PPO",
  "MCCP - Workers Comp",
  "Molina - AHCCCS",
  "Multiplan Claritev Auto",
  "Multiplan Claritev Medicare Advantage Plans",
  "Multiplan Claritev PPO",
  "Multiplan Claritev ValuePoint - Discount",
  "Multiplan Claritev Workers Comp",
  "Prime Health IME - EPO",
  "Prime Health Personal Injury Network - AP",
  "Prime Health PPO, Auto, WC",
  "Prime Health Telemedicine Program for Workers Comp",
  "Prime Health WTC - Discount",
  "Prospect - SCAN Desert Health Plan",
  "Prospect Letter of Intent",
  "Provider Network of America Auto",
  "Provider Network of America Primary PPO",
  "Provider Network of America Supplemental - AP",
  "Provider Network of America Workers Comp",
  "Provider Select, Inc. - PPO",
  "Three Rivers Provider Network Contigo Health PPO",
  "UPMC - PPO",
  "USA Auto Medical",
  "USA Managed Care PPO",
  "USA Workers Comp",
  "Velocity Auto",
  "Velocity PPO",
  "Velocity Workers Comp",
  "Zelis Healthcare Auto",
  "Zelis Healthcare Medicaid/AHCCCS",
  "Zelis Healthcare Medicare",
  "Zelis Healthcare Primary Plan PPO",
  "Zelis Healthcare Supplemental - Discount",
  "Zelis Healthcare Workers Comp",
];

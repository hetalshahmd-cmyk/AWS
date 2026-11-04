/**
 * The only outside sources an AI-written article may cite. Each address was
 * opened and its page title checked by hand (October 2026) — the AI picks
 * from this list by id and never writes a web address itself, so it can't
 * invent a source. Re-check the list now and then; add pages the same way.
 *
 * ACOG and CDC pages are not here only because their sites block automated
 * checks; an editor can still cite them by hand in the article editor.
 */
export type Reference = {
  id: string;
  title: string;
  publisher: string;
  url: string;
};

const MEDLINE = "MedlinePlus (U.S. National Library of Medicine)";
const OWH = "Office on Women's Health (HHS)";
const NICHD = "NICHD (National Institutes of Health)";

export const REFERENCES: Reference[] = [
  { id: "medline-pregnancy", title: "Pregnancy", publisher: MEDLINE, url: "https://medlineplus.gov/pregnancy.html" },
  { id: "medline-prenatal-care", title: "Prenatal Care", publisher: MEDLINE, url: "https://medlineplus.gov/prenatalcare.html" },
  { id: "medline-prenatal-testing", title: "Prenatal Testing", publisher: MEDLINE, url: "https://medlineplus.gov/prenataltesting.html" },
  { id: "medline-pregnancy-test", title: "Pregnancy Test", publisher: MEDLINE, url: "https://medlineplus.gov/lab-tests/pregnancy-test/" },
  { id: "medline-pregnancy-test-encyclopedia", title: "Pregnancy test (Medical Encyclopedia)", publisher: MEDLINE, url: "https://medlineplus.gov/ency/article/003432.htm" },
  { id: "medline-ultrasound", title: "Ultrasound", publisher: MEDLINE, url: "https://medlineplus.gov/ultrasound.html" },
  { id: "medline-nutrition", title: "Pregnancy and Nutrition", publisher: MEDLINE, url: "https://medlineplus.gov/pregnancyandnutrition.html" },
  { id: "medline-high-blood-pressure", title: "High Blood Pressure in Pregnancy", publisher: MEDLINE, url: "https://medlineplus.gov/highbloodpressureinpregnancy.html" },
  { id: "medline-ectopic", title: "Ectopic Pregnancy", publisher: MEDLINE, url: "https://medlineplus.gov/ectopicpregnancy.html" },
  { id: "medline-miscarriage", title: "Miscarriage", publisher: MEDLINE, url: "https://medlineplus.gov/miscarriage.html" },
  { id: "medline-teen-pregnancy", title: "Teenage Pregnancy", publisher: MEDLINE, url: "https://medlineplus.gov/teenagepregnancy.html" },
  { id: "medline-birth-control", title: "Birth Control", publisher: MEDLINE, url: "https://medlineplus.gov/birthcontrol.html" },
  { id: "medline-pap-smear", title: "Pap Smear", publisher: MEDLINE, url: "https://medlineplus.gov/lab-tests/pap-smear/" },
  { id: "medline-menstruation", title: "Menstruation", publisher: MEDLINE, url: "https://medlineplus.gov/menstruation.html" },
  { id: "medline-ovarian-cysts", title: "Ovarian Cysts", publisher: MEDLINE, url: "https://medlineplus.gov/ovariancysts.html" },
  { id: "medline-fibroids", title: "Uterine Fibroids", publisher: MEDLINE, url: "https://medlineplus.gov/uterinefibroids.html" },
  { id: "medline-pcos", title: "Polycystic Ovary Syndrome", publisher: MEDLINE, url: "https://medlineplus.gov/polycysticovarysyndrome.html" },
  { id: "medline-vaginitis", title: "Vaginitis", publisher: MEDLINE, url: "https://medlineplus.gov/vaginitis.html" },
  { id: "medline-sti", title: "Sexually Transmitted Infections", publisher: MEDLINE, url: "https://medlineplus.gov/sexuallytransmittedinfections.html" },
  { id: "owh-pregnancy", title: "Pregnancy", publisher: OWH, url: "https://womenshealth.gov/pregnancy" },
  { id: "owh-prenatal-care", title: "Prenatal care", publisher: OWH, url: "https://womenshealth.gov/a-z-topics/prenatal-care" },
  { id: "owh-prenatal-tests", title: "Prenatal care and tests", publisher: OWH, url: "https://womenshealth.gov/pregnancy/youre-pregnant-now-what/prenatal-care-and-tests" },
  { id: "owh-stages", title: "Stages of pregnancy", publisher: OWH, url: "https://womenshealth.gov/pregnancy/youre-pregnant-now-what/stages-pregnancy" },
  { id: "owh-body-changes", title: "Body changes and discomforts", publisher: OWH, url: "https://womenshealth.gov/pregnancy/youre-pregnant-now-what/body-changes-and-discomforts" },
  { id: "owh-birth-control", title: "Birth control methods", publisher: OWH, url: "https://womenshealth.gov/a-z-topics/birth-control-methods" },
  { id: "nichd-pregnancy", title: "Pregnancy", publisher: NICHD, url: "https://www.nichd.nih.gov/health/topics/pregnancy" },
  { id: "nichd-prenatal-care", title: "What is prenatal care and why is it important?", publisher: NICHD, url: "https://www.nichd.nih.gov/health/topics/pregnancy/conditioninfo/prenatal-care" },
  { id: "nichd-preconception", title: "Pre-Pregnancy Care and Prenatal Care", publisher: NICHD, url: "https://www.nichd.nih.gov/health/topics/preconceptioncare" },
  { id: "azdhs-wic", title: "Women, Infants and Children (WIC)", publisher: "Arizona Department of Health Services", url: "https://www.azdhs.gov/prevention/azwic/index.php" },
];

export const referenceById = (id: string) => REFERENCES.find((reference) => reference.id === id) ?? null;

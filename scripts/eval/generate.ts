/**
 * Generates the synthetic extraction eval set: denial letters and EOBs whose ground truth is
 * known by construction. Every fact is drawn first, then the document is written around it, so
 * no case is ever labelled by a model.
 *
 *   pnpm eval:generate                      # 60 cases into eval/cases (seed 20261016)
 *   pnpm eval:generate --count 120 --seed 7 # a different, larger set
 *
 * Writes <id>.source.json (rendered to PDF by `pnpm gen:samples eval/cases`) and
 * <id>.truth.json for each case. Deterministic: the same seed always gives the same files.
 * All names, plans, addresses and identifiers are fictional.
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DenialCategory } from "@/lib/schemas/core";
import type { EobSource, Expected, Insurer, LetterSource, Source, StatedDeadlineTruth, Trap, Truth } from "./types";

/* ------------------------------------------------------------------ args & randomness */

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** mulberry32: tiny, fast, and identical on every machine — enough for test fixtures. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = prng(20261016);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");

/* ------------------------------------------------------------------ formatting */

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/** Lower-case a service name for mid-sentence use, keeping acronyms such as MRI, CT or GI. */
const lower = (s: string) => s.split(" ").map((w) => (/[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase())).join(" ");

/* ------------------------------------------------------------------ fictional pools */

const STATES: Record<string, readonly (readonly [string, string])[]> = {
  CA: [["Sacramento", "95814"], ["Fresno", "93721"], ["Oakland", "94612"]],
  NY: [["Albany", "12207"], ["Buffalo", "14202"], ["Yonkers", "10701"]],
  TX: [["Austin", "78701"], ["El Paso", "79901"], ["Houston", "77002"]],
  FL: [["Tampa", "33602"], ["Orlando", "32801"]],
  IL: [["Springfield", "62701"], ["Peoria", "61602"]],
  OH: [["Columbus", "43215"], ["Toledo", "43604"]],
  PA: [["Harrisburg", "17101"], ["Erie", "16501"]],
  GA: [["Macon", "31201"], ["Savannah", "31401"]],
};
type StateCode = "CA" | "NY" | "TX" | "FL" | "IL" | "OH" | "PA" | "GA";
const STATE_CODES = Object.keys(STATES) as StateCode[];

const INSURERS = [
  { name: "Quillfield Health Plan", logo: "QUILLFIELD" },
  { name: "Brightmoor Benefit Solutions", logo: "BRIGHTMOOR" },
  { name: "Calloway Health Network", logo: "CALLOWAY" },
  { name: "Ostrander Mutual Health", logo: "OSTRANDER" },
  { name: "Tamsin Health Partners", logo: "TAMSIN" },
  { name: "Verdane Health Plan", logo: "VERDANE" },
  { name: "Larkspur Benefit Administrators", logo: "LARKSPUR" },
  { name: "Hollis Creek Health", logo: "HOLLIS CREEK" },
] as const;

const FIRST = ["Maria", "DeShawn", "Priya", "Tomás", "Aiko", "Fatima", "Connor", "Lakshmi", "Elena", "Kwame", "Mei", "Rosa", "Jamal", "Ingrid", "Hiroshi", "Nadia"];
const LAST = ["Alvarez", "Okafor", "Raman", "Lindqvist", "Nakamura", "Haddad", "Brennan", "Iyer", "Castillo", "Mensah", "Zhou", "Delgado", "Whitaker", "Sørensen", "Tanaka", "Petrova"];
const STREETS = ["Willow Court", "Pecan Ridge Drive", "Harbor Lane", "Juniper Street", "Maple Avenue", "Cedar Bluff Road", "Orchard Way", "Lakeview Terrace"];
const EMPLOYERS = ["Hudson Valley Logistics, Inc.", "Bayou City Fabrication", "Redwood Dental Group", "Great Lakes Freight Co.", "Peachtree Analytics LLC", "Keystone Machine Works"];
const PRACTICES = ["Riverside Orthopedic Associates", "Northgate Imaging Center", "Summitview Family Medicine", "Clearwater Neurology Group", "Meadowbrook Physical Therapy", "Lantern Hill Cardiology", "Westfield Sleep Clinic", "Copperline Laboratory Services"];
const ER_GROUPS = ["Gulf Coast Emergency Physicians, PLLC", "Pinewood Emergency Associates", "Metro Emergency Care Group"];

type Service = { text: string; cpt: string; billed: [number, number]; inpatient?: boolean };
const SERVICES: Record<string, Service[]> = {
  imaging: [
    { text: "MRI of the left knee without contrast", cpt: "73721", billed: [1800, 3200] },
    { text: "MRI of the lumbar spine without contrast", cpt: "72148", billed: [1900, 3400] },
    { text: "CT scan of the chest with contrast", cpt: "71260", billed: [1200, 2600] },
  ],
  therapy: [
    { text: "Physical therapy, therapeutic exercise (12 sessions)", cpt: "97110", billed: [900, 2100] },
    { text: "Occupational therapy evaluation", cpt: "97165", billed: [250, 480] },
  ],
  procedure: [
    { text: "Arthroscopic knee meniscectomy", cpt: "29881", billed: [7400, 14800] },
    { text: "Polysomnography sleep study", cpt: "95810", billed: [2100, 4200] },
    { text: "Upper GI endoscopy with biopsy", cpt: "43239", billed: [2400, 5200] },
  ],
  novel: [
    { text: "Transcranial magnetic stimulation (TMS) treatment course", cpt: "90867", billed: [6200, 11800] },
    { text: "Genetic expression profiling test for breast cancer", cpt: "81519", billed: [3400, 4600] },
  ],
  lab: [
    { text: "Comprehensive metabolic panel and lipid panel", cpt: "80053", billed: [180, 420] },
    { text: "Vitamin D, 25-hydroxy level", cpt: "82306", billed: [120, 260] },
  ],
  er: [
    { text: "Emergency department visit, level 4", cpt: "99284", billed: [1400, 2600] },
    { text: "Emergency department visit, level 5", cpt: "99285", billed: [2200, 3900] },
  ],
  inpatient: [
    { text: "Continued inpatient rehabilitation stay", cpt: "0128", billed: [18000, 42000], inpatient: true },
    { text: "Continued acute inpatient stay", cpt: "0120", billed: [14000, 36000], inpatient: true },
  ],
};

type Cat = Exclude<DenialCategory, "other">;
/** Each category: where its services come from, its CARC code, and two ways to say why. */
const CATEGORIES: Record<Cat, { pools: string[]; code: string; reasons: ((svc: string, guide: string) => string)[] }> = {
  medical_necessity: {
    pools: ["imaging", "therapy", "procedure", "inpatient"],
    code: "CO-50",
    reasons: [
      (svc, g) => `Reason for denial: The ${lower(svc)} is not medically necessary. Our clinical guideline ${g} requires documentation of conservative treatment before this service, and the records submitted do not show it.`,
      (svc, g) => `We determined that the ${lower(svc)} does not meet our criteria for medical necessity under guideline ${g}. The information we received does not support the need for this service at this time.`,
    ],
  },
  prior_auth: {
    pools: ["imaging", "procedure"],
    code: "CO-197",
    reasons: [
      (svc) => `Reason for denial: Prior authorization was required for the ${lower(svc)} and was not obtained before the service was performed.`,
      (svc) => `Your plan requires pre-certification for the ${lower(svc)}. Our records show no approved authorization on file for this date of service.`,
    ],
  },
  out_of_network: {
    pools: ["imaging", "therapy"],
    code: "CO-242",
    reasons: [
      () => `Reason for denial: The provider is not in your plan's network. Your plan does not cover services from out-of-network providers except in an emergency.`,
      () => `This claim was denied because the provider who performed the service is out-of-network for your plan.`,
    ],
  },
  not_covered: {
    pools: ["therapy", "lab", "procedure"],
    code: "CO-96",
    reasons: [
      (svc) => `Reason for denial: The ${lower(svc)} is not a covered benefit under your plan. It is listed as an exclusion in your benefit booklet.`,
      () => `Your plan has reached its annual benefit limit for this type of service, so this claim is not covered.`,
    ],
  },
  coding_admin: {
    pools: ["lab", "imaging"],
    code: "CO-16",
    reasons: [
      () => `Reason for denial: The claim lacks information needed for adjudication. The diagnosis code submitted by the provider is missing or invalid.`,
      () => `We could not process this claim because of a billing error: the procedure code does not match the place of service reported by the provider.`,
    ],
  },
  experimental: {
    pools: ["novel"],
    code: "CO-55",
    reasons: [
      (svc) => `Reason for denial: The ${lower(svc)} is considered experimental or investigational for your condition under our medical policy.`,
      (svc) => `Our medical policy considers the ${lower(svc)} unproven for the diagnosis submitted, so it is excluded as investigational.`,
    ],
  },
  timely_filing: {
    pools: ["lab", "therapy", "imaging"],
    code: "CO-29",
    reasons: [
      () => `Reason for denial: The claim was received after the filing deadline. Claims must be submitted within 90 days of the date of service.`,
      () => `This claim was not filed within the time limit set by your plan and cannot be paid.`,
    ],
  },
  duplicate: {
    pools: ["lab", "imaging"],
    code: "CO-18",
    reasons: [
      () => `Reason for denial: This claim duplicates a claim we have already processed for the same service and date.`,
      () => `We denied this claim as an exact duplicate of a previously submitted claim.`,
    ],
  },
};
const CATEGORY_ORDER = Object.keys(CATEGORIES) as Cat[];

/* ------------------------------------------------------------------ one case */

type Plan = "commercial" | "medicare" | "medicaid";

function makeInsurer(state: StateCode): Insurer {
  const ins = pick(INSURERS);
  const [city, zip] = pick(STATES[state]);
  return {
    name: ins.name,
    address: `PO Box ${int(1000, 99999)}, ${city}, ${state} ${zip}`,
    phone: `1-800-555-${digits(4)}`,
    logo_text: ins.logo,
  };
}

function makeMember(state: StateCode, plan: Plan, prefix: string) {
  const [city, zip] = pick(STATES[state]);
  const group =
    plan === "medicare"
      ? `Medicare Advantage HMO, plan H${digits(4)}`
      : plan === "medicaid"
        ? `Medicaid Managed Care, plan MC-${digits(3)}`
        : `GRP-${digits(5)} (${pick(EMPLOYERS)})`;
  return {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    address: `${int(12, 9800)} ${pick(STREETS)}\n${city}, ${state} ${zip}`,
    member_id: `${prefix}-${digits(6)}-${digits(2)}`,
    group,
  };
}

/** Which traps to plant in this case: a deterministic rotation so every trap gets coverage. */
function trapsFor(i: number): Trap[] {
  const rotation: Trap[][] = [
    [],
    ["vague_owed"],
    ["no_letter_date"],
    ["deadline_as_date"],
    ["short_deadline", "us_date_format"],
    ["no_deadline"],
    ["medicare_advantage"],
    ["urgent_case"],
    ["insurer_out_of_state"],
    ["medicaid_managed_care", "vague_owed"],
    ["emergency_visit"],
    ["us_date_format"],
  ];
  return rotation[i % rotation.length];
}

function buildCase(i: number): { source: Source; truth: Truth } {
  let traps = trapsFor(i);
  const kind: Source["kind"] = i % 3 === 2 ? "eob" : "letter";
  // Out-of-network denials and emergencies read most naturally on an EOB; keep letters for the rest.
  let category: Cat = CATEGORY_ORDER[i % CATEGORY_ORDER.length];
  if (traps.includes("emergency_visit")) category = "out_of_network";
  if (traps.includes("urgent_case")) category = "medical_necessity";
  // Some traps only exist on one kind of document.
  if (kind === "eob") traps = traps.filter((t) => t !== "vague_owed" && t !== "urgent_case");

  const plan: Plan = traps.includes("medicare_advantage") ? "medicare" : traps.includes("medicaid_managed_care") ? "medicaid" : "commercial";
  const state = STATE_CODES[i % STATE_CODES.length];
  const insurerState = traps.includes("insurer_out_of_state") ? pick(STATE_CODES.filter((s) => s !== state)) : state;
  const insurer = makeInsurer(insurerState);
  const member = makeMember(state, plan, insurer.logo_text.slice(0, 3).replace(/\s/g, ""));

  const pool = traps.includes("emergency_visit") ? "er" : traps.includes("urgent_case") ? "inpatient" : pick(CATEGORIES[category].pools.filter((p) => p !== "inpatient"));
  const service = pick(SERVICES[pool]);
  const codeLabel = service.inpatient ? "Revenue code" : "CPT";
  const billed = round2(int(service.billed[0], service.billed[1]) + int(0, 99) / 100);

  const letterDate = `2026-${String(int(7, 10)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
  const serviceDate = addDays(letterDate, -int(12, 45));
  const writtenServiceDate = traps.includes("us_date_format") ? usDate(serviceDate) : serviceDate;
  const claimNumber = `CLM-26-${digits(4)}-${digits(5)}`;
  const guide = `${insurer.logo_text.slice(0, 3).replace(/\s/g, "")}-${pick(["MSK", "RAD", "NEU", "CAR"])}-${digits(3)}`;
  const code = CATEGORIES[category].code;
  const reason = pick(CATEGORIES[category].reasons)(service.text, guide);
  const emergency = pool === "er";
  const network: Expected["network_status"] = category === "out_of_network" ? "out_of_network" : kind === "eob" ? "in_network" : "unknown";

  const deadline: StatedDeadlineTruth = traps.includes("no_deadline")
    ? null
    : traps.includes("deadline_as_date")
      ? { kind: "date", date: addDays(letterDate, 180) }
      : { kind: "days", days: traps.includes("short_deadline") ? 60 : 180 };

  const appealsAddress = `${insurer.name}, Appeals Unit, ${insurer.address}`;
  const deadlineSentence =
    deadline === null
      ? `To ask us to reconsider, write to ${appealsAddress}.`
      : deadline.kind === "date"
        ? `Your written appeal must be received by ${longDate(deadline.date)}. Send it to ${appealsAddress}.`
        : `You or your authorized representative may file a written appeal within ${deadline.days} days of the date you receive this notice. Send it to ${appealsAddress}.`;
  const expedited = `If waiting for a standard decision could seriously harm your health, you may ask for an expedited appeal by calling ${insurer.phone}.`;
  const programWords = plan === "medicare" ? "your Medicare Advantage plan" : plan === "medicaid" ? "your Medicaid managed care plan" : "your health plan";

  let source: Source;
  let amounts: Expected["amounts"];
  let codes: string[];
  const providerName = emergency ? pick(ER_GROUPS) : pick(PRACTICES);

  if (kind === "letter") {
    const vague = traps.includes("vague_owed");
    const urgent = traps.includes("urgent_case");
    const paragraphs = [
      `We reviewed the claim submitted by ${providerName} under ${programWords} for services provided on ${longDate(serviceDate)}. After review, we are unable to approve payment.`,
      `${reason} Reason code: ${code}.`,
      vague
        ? `The plan paid $0.00 of the $${money(billed)} billed. The provider may bill you for this service.`
        : `The plan paid $0.00 of the $${money(billed)} billed. The amount you may owe the provider is $${money(billed)}.`,
    ];
    if (urgent) paragraphs.splice(1, 0, `Because you are currently receiving inpatient care, this request was handled as an expedited concurrent review.`);
    source = {
      kind: "letter",
      insurer,
      date: traps.includes("no_letter_date") ? "" : letterDate,
      member,
      re: { claim_number: claimNumber, provider: providerName, service: `${service.text} (${codeLabel} ${service.cpt})`, service_date: writtenServiceDate, billed: money(billed) },
      title: "Notice of Adverse Benefit Determination",
      paragraphs,
      appeal: {
        heading: "Your Right to Appeal",
        text: `${deadlineSentence} ${expedited}`,
        external: `After the internal appeal, you may have the right to an independent external review. Free help is available from your state's consumer assistance program.`,
      },
      signature: `Utilization Management Department\n${insurer.name}`,
    } satisfies LetterSource;
    amounts = { billed, allowed: null, plan_paid: 0, patient_responsibility: vague ? null : billed };
    codes = [code];
  } else {
    const fullDenial = category !== "out_of_network";
    const allowed = fullDenial ? 0 : round2(billed * (0.3 + rand() * 0.15));
    const planPaid = fullDenial ? 0 : round2(allowed * 0.8);
    const owe = round2(billed - planPaid);
    const coinsurance = round2(allowed - planPaid);
    const notCovered = round2(billed - allowed);
    const participating = category === "out_of_network" ? "(non-participating)" : "(participating)";
    source = {
      kind: "eob",
      insurer,
      date: traps.includes("no_letter_date") ? "" : letterDate,
      member,
      claim: {
        claim_number: claimNumber,
        provider: `${providerName} ${participating}`,
        facility: emergency ? "Mercy Lakes Medical Center (participating)" : "",
        service_date: writtenServiceDate,
        service: `${service.text} (${codeLabel} ${service.cpt})`,
      },
      lines: [
        {
          service: `${service.text.split(",")[0]} - ${service.cpt}`,
          billed: money(billed),
          allowed: money(allowed),
          plan_paid: money(planPaid),
          copay: "0.00",
          deductible: "0.00",
          coinsurance: money(coinsurance),
          not_covered: money(notCovered),
          remark: code,
        },
      ],
      totals: { billed: money(billed), allowed: money(allowed), plan_paid: money(planPaid), you_may_owe: money(owe) },
      remarks: [`${code}: ${reason}`],
      appeal: `This is not a bill. ${plan === "commercial" ? "" : `This statement is for ${programWords}. `}${deadlineSentence} ${expedited}`,
    } satisfies EobSource;
    amounts = { billed, allowed, plan_paid: planPaid, patient_responsibility: owe };
    codes = [code];
  }

  const expected: Expected = {
    document_type: kind === "eob" ? "eob" : "denial_letter",
    program_signals: plan,
    insurer_name: insurer.name,
    member_id: member.member_id,
    claim_number: claimNumber,
    letter_date: traps.includes("no_letter_date") ? null : letterDate,
    provider_name: providerName,
    service: { text: service.text, cpt: service.cpt },
    service_dates: [serviceDate],
    denial_category: category,
    denial_codes: codes,
    amounts,
    network_status: network,
    emergency_signals: emergency,
    urgency_signals: traps.includes("urgent_case"),
    stated_appeal_deadline: deadline,
    state_hint: state,
  };
  // Every letter carries the generic expedited-appeal sentence; on a non-urgent case that is the trap.
  const planted: Trap[] = [...traps, ...(traps.includes("urgent_case") ? [] : (["boilerplate_expedited"] as Trap[]))];
  const id = `eval-${String(i + 1).padStart(3, "0")}-${category.replace(/_/g, "-")}-${kind}`;
  return { source, truth: { id, kind, category, traps: planted, expected } };
}

/* ------------------------------------------------------------------ main */

async function main() {
  const count = Number(arg("--count") ?? 60);
  const seed = Number(arg("--seed") ?? 20261016);
  const out = path.resolve(arg("--out") ?? "eval/cases");
  rand = prng(seed);

  await mkdir(out, { recursive: true });
  // Regenerate cleanly: stale cases from a larger earlier run must not linger in the set.
  for (const f of await readdir(out)) if (/^eval-\d+.*\.(source|truth)\.json$|^eval-\d+.*\.pdf$/.test(f)) await rm(path.join(out, f));

  const tally = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const { source, truth } = buildCase(i);
    await writeFile(path.join(out, `${truth.id}.source.json`), JSON.stringify(source, null, 2) + "\n");
    await writeFile(path.join(out, `${truth.id}.truth.json`), JSON.stringify(truth, null, 2) + "\n");
    for (const t of truth.traps) tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  console.log(`wrote ${count} cases to ${path.relative(process.cwd(), out)} (seed ${seed})`);
  console.log("traps:", Object.fromEntries([...tally].sort()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

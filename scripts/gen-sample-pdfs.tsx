/**
 * Renders the synthetic sample documents in data/samples/*.source.json to PDF.
 * Run: pnpm gen:samples
 * Everything here is fictional; each page carries a diagonal "SAMPLE" watermark.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToFile } from "@react-pdf/renderer";

type Letter = {
  kind: "letter";
  insurer: { name: string; address: string; phone: string; logo_text: string };
  date: string;
  member: { name: string; address: string; member_id: string; group: string };
  re: { claim_number: string; provider: string; service: string; service_date: string; billed: string };
  title: string;
  paragraphs: string[];
  appeal: { heading: string; text: string; external: string };
  signature: string;
};

type Eob = {
  kind: "eob";
  insurer: Letter["insurer"];
  date: string;
  member: Letter["member"];
  claim: { claim_number: string; provider: string; facility: string; service_date: string; service: string };
  lines: Array<Record<"service" | "billed" | "allowed" | "plan_paid" | "copay" | "deductible" | "coinsurance" | "not_covered" | "remark", string>>;
  totals: { billed: string; allowed: string; plan_paid: string; you_may_owe: string };
  remarks: string[];
  appeal: string;
};

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 60, paddingHorizontal: 60, fontSize: 10.5, fontFamily: "Helvetica", lineHeight: 1.45, color: "#111" },
  watermark: { position: "absolute", top: 330, left: 40, transform: "rotate(-30deg)", fontSize: 54, color: "#d8d8d8", fontFamily: "Helvetica-Bold", opacity: 0.55 },
  letterhead: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: "#1f3a5f", paddingBottom: 8, marginBottom: 16 },
  logo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1f3a5f", letterSpacing: 1.5 },
  small: { fontSize: 8.5, color: "#444" },
  h1: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 8 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  p: { marginBottom: 8 },
  box: { borderWidth: 1, borderColor: "#999", padding: 8, marginBottom: 12 },
  row: { flexDirection: "row" },
  label: { width: 110, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#999", marginTop: 8, marginBottom: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#bbb" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.5, padding: 3, backgroundColor: "#e9eef4" },
  td: { fontSize: 7.5, padding: 3 },
  footer: { position: "absolute", bottom: 28, left: 60, right: 60, fontSize: 7.5, color: "#666", textAlign: "center" },
});

const Watermark = () => <Text style={s.watermark} fixed>SAMPLE - FICTIONAL DOCUMENT</Text>;

const Letterhead = ({ insurer }: { insurer: Letter["insurer"] }) => (
  <View style={s.letterhead} fixed>
    <Text style={s.logo}>{insurer.logo_text}</Text>
    <View>
      <Text style={s.small}>{insurer.name}</Text>
      <Text style={s.small}>{insurer.address}</Text>
      <Text style={s.small}>Member Services {insurer.phone}</Text>
    </View>
  </View>
);

const Footer = ({ name }: { name: string }) => (
  <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${name} · This is a synthetic document created for the Overturn demo. Names, identifiers, and addresses are fictional. Page ${pageNumber} of ${totalPages}`} />
);

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const LetterDoc = ({ d }: { d: Letter }) => (
  <Document title={d.title} author={d.insurer.name}>
    <Page size="LETTER" style={s.page}>
      <Watermark />
      <Letterhead insurer={d.insurer} />
      <Text style={s.p}>{fmtDate(d.date)}</Text>
      <Text>{d.member.name}</Text>
      {d.member.address.split("\n").map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
      <View style={[s.box, { marginTop: 12 }]}>
        <View style={s.row}><Text style={s.label}>Member ID:</Text><Text>{d.member.member_id}</Text></View>
        <View style={s.row}><Text style={s.label}>Group:</Text><Text>{d.member.group}</Text></View>
        <View style={s.row}><Text style={s.label}>Claim / Ref #:</Text><Text>{d.re.claim_number}</Text></View>
        <View style={s.row}><Text style={s.label}>Provider:</Text><Text>{d.re.provider}</Text></View>
        <View style={s.row}><Text style={s.label}>Service:</Text><Text>{d.re.service}</Text></View>
        <View style={s.row}><Text style={s.label}>Date(s) of service:</Text><Text>{d.re.service_date}</Text></View>
        {d.re.billed ? <View style={s.row}><Text style={s.label}>Amount billed:</Text><Text>${d.re.billed}</Text></View> : null}
      </View>
      <Text style={s.h1}>{d.title}</Text>
      <Text style={s.p}>Dear {d.member.name.split(" ")[0]},</Text>
      {d.paragraphs.map((p, i) => (
        <Text key={i} style={s.p}>{p}</Text>
      ))}
      <Text style={s.h2}>{d.appeal.heading}</Text>
      <Text style={s.p}>{d.appeal.text}</Text>
      <Text style={s.p}>{d.appeal.external}</Text>
      <Text style={{ marginTop: 14 }}>Sincerely,</Text>
      {d.signature.split("\n").map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
      <Footer name={d.insurer.name} />
    </Page>
  </Document>
);

const COLS: Array<[keyof Eob["lines"][number], string, number]> = [
  ["service", "Service", 2.2],
  ["billed", "Billed", 1],
  ["allowed", "Allowed", 1],
  ["plan_paid", "Plan paid", 1],
  ["copay", "Copay", 0.8],
  ["deductible", "Deductible", 1],
  ["coinsurance", "Coinsurance", 1],
  ["not_covered", "Not covered", 1],
  ["remark", "Remarks", 1.2],
];

const EobDoc = ({ d }: { d: Eob }) => (
  <Document title="Explanation of Benefits" author={d.insurer.name}>
    <Page size="LETTER" style={s.page}>
      <Watermark />
      <Letterhead insurer={d.insurer} />
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View>
          <Text style={s.h1}>Explanation of Benefits</Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>THIS IS NOT A BILL</Text>
        </View>
        <View>
          <Text style={s.small}>Statement date: {fmtDate(d.date)}</Text>
          <Text style={s.small}>Claim number: {d.claim.claim_number}</Text>
          <Text style={s.small}>Member ID: {d.member.member_id}</Text>
          <Text style={s.small}>Group: {d.member.group}</Text>
        </View>
      </View>
      <View style={[s.box, { marginTop: 10 }]}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.member.name}</Text>
        {d.member.address.split("\n").map((l, i) => (
          <Text key={i}>{l}</Text>
        ))}
      </View>
      <View style={s.row}><Text style={s.label}>Provider:</Text><Text>{d.claim.provider}</Text></View>
      {d.claim.facility ? <View style={s.row}><Text style={s.label}>Facility:</Text><Text>{d.claim.facility}</Text></View> : null}
      <View style={s.row}><Text style={s.label}>Date of service:</Text><Text>{d.claim.service_date}</Text></View>
      <View style={s.row}><Text style={s.label}>Services:</Text><Text>{d.claim.service}</Text></View>
      <View style={s.table}>
        <View style={s.tr}>
          {COLS.map(([k, label, flex]) => (
            <Text key={k} style={[s.th, { flex }]}>{label}</Text>
          ))}
        </View>
        {d.lines.map((line, i) => (
          <View key={i} style={s.tr}>
            {COLS.map(([k, , flex]) => (
              <Text key={k} style={[s.td, { flex }]}>{k === "service" || k === "remark" ? line[k] : `$${line[k]}`}</Text>
            ))}
          </View>
        ))}
        <View style={[s.tr, { backgroundColor: "#f3f5f8" }]}>
          <Text style={[s.th, { flex: 2.2 }]}>Totals</Text>
          <Text style={[s.th, { flex: 1 }]}>${d.totals.billed}</Text>
          <Text style={[s.th, { flex: 1 }]}>${d.totals.allowed}</Text>
          <Text style={[s.th, { flex: 1 }]}>${d.totals.plan_paid}</Text>
          <Text style={[s.th, { flex: 5 }]}>Amount you may owe the provider: ${d.totals.you_may_owe}</Text>
        </View>
      </View>
      <Text style={s.h2}>Remark codes</Text>
      {d.remarks.map((r, i) => (
        <Text key={i} style={{ fontSize: 9, marginBottom: 3 }}>{r}</Text>
      ))}
      <Text style={s.h2}>Appeal rights</Text>
      <Text style={{ fontSize: 9 }}>{d.appeal}</Text>
      <Footer name={d.insurer.name} />
    </Page>
  </Document>
);

async function main() {
  const dir = path.join(process.cwd(), "data", "samples");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".source.json"));
  for (const f of files) {
    const data = JSON.parse(await readFile(path.join(dir, f), "utf8")) as Letter | Eob;
    const out = path.join(dir, f.replace(".source.json", ".pdf"));
    await renderToFile(data.kind === "eob" ? <EobDoc d={data} /> : <LetterDoc d={data} />, out);
    console.log("wrote", path.basename(out));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

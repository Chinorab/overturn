// Renders a cached sample letter to PDF with the same component the browser uses (smoke check).
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToFile } from "@react-pdf/renderer";

async function main() {
  const id = process.argv[2] ?? "01-medical-necessity-ny";
  const { LetterPdf } = await import("../components/letter-pdf");
  const { ALL_RULES } = await import("../lib/rules/load");
  const letter = JSON.parse(readFileSync(path.join("data", "samples", `${id}.letter.json`), "utf8"));
  const rules = ALL_RULES.filter((r) => letter.cited_rule_ids.includes(r.id));
  const out = path.join(process.env.OUT ?? ".", `${id}.letter.pdf`);
  await renderToFile(<LetterPdf sections={letter.sections} rules={rules} />, out);
  console.log("wrote", out);
}
main();

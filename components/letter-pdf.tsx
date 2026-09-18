"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Rule } from "@/lib/rules/schema";

const s = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 64, paddingHorizontal: 72, fontSize: 11, fontFamily: "Times-Roman", lineHeight: 1.5, color: "#111" },
  p: { marginBottom: 10 },
  h: { fontFamily: "Times-Bold", marginTop: 6, marginBottom: 4 },
  footer: { position: "absolute", bottom: 32, left: 72, right: 72, fontSize: 8, color: "#666" },
  sources: { marginTop: 18, borderTopWidth: 1, borderTopColor: "#999", paddingTop: 8, fontSize: 9, color: "#333" },
});

/**
 * The downloadable letter. Citations are printed as legal references in the text and
 * listed once more at the end with their sources, so the recipient can check them too.
 */
export function LetterPdf({ sections, rules }: { sections: Array<{ heading?: string; text: string }>; rules: Rule[] }) {
  const cite = (t: string) =>
    t.replace(/\s*\[\[cite:([a-z0-9_.]+)\]\]/g, (_m, id: string) => {
      const rule = rules.find((r) => r.id === id);
      return rule ? ` (${rule.legal_ref})` : "";
    });
  return (
    <Document title="Appeal letter" author="Drafted with Overturn">
      <Page size="LETTER" style={s.page}>
        {sections.map((sec, i) => (
          <View key={i} wrap={false}>
            {sec.heading ? <Text style={s.h}>{sec.heading}</Text> : null}
            {cite(sec.text)
              .split(/\n{2,}/)
              .map((para, j) => (
                <Text key={j} style={s.p}>
                  {para.split("\n").map((line, k, arr) => (k < arr.length - 1 ? `${line}\n` : line))}
                </Text>
              ))}
          </View>
        ))}
        {rules.length > 0 && (
          <View style={s.sources}>
            <Text style={{ fontFamily: "Times-Bold", marginBottom: 3 }}>References</Text>
            {rules.map((r) => (
              <Text key={r.id}>
                {r.legal_ref} — {r.title}. {r.source_url}
              </Text>
            ))}
          </View>
        )}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Drafted with Overturn from the sender's own documents; reviewed and sent by the sender. Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

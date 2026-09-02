import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReportDocument } from "@/lib/reports/document";

/**
 * Report renderer.
 *
 * Takes a validated ReportDocument and produces a PDF. It contains presentation
 * only: no business rules, no data fetching, no decisions about what belongs in
 * a report. Swapping the PDF engine should not touch anything else.
 */
export interface ReportRenderer {
  render(document: ReportDocument): Promise<{ bytes: Uint8Array; mimeType: string; pageCount: number | null }>;
}

/** Ravish Astro palette, mirrored from the design tokens. */
const COLORS = {
  midnight: "#050814",
  surface: "#0a1020",
  border: "#1e2942",
  ink: "#11151f",
  body: "#2c3444",
  muted: "#5b6578",
  primary: "#2f5bd0",
  premium: "#9a7b33",
  paper: "#ffffff",
  paperSubtle: "#f4f6fb",
};

const styles = StyleSheet.create({
  coverPage: {
    backgroundColor: COLORS.midnight,
    color: "#f7f9ff",
    paddingVertical: 90,
    paddingHorizontal: 56,
  },
  coverBrand: { fontSize: 11, letterSpacing: 3, color: COLORS.premium, textTransform: "uppercase" },
  coverTitle: { fontSize: 32, marginTop: 26, lineHeight: 1.25 },
  coverSubject: { fontSize: 15, marginTop: 20, color: "#c3cce4" },
  coverRule: { marginTop: 30, marginBottom: 30, height: 1, backgroundColor: "#26324e" },
  coverMetaRow: { flexDirection: "row", marginBottom: 7 },
  coverMetaLabel: { width: 130, fontSize: 9, color: "#74809b", textTransform: "uppercase", letterSpacing: 1 },
  coverMetaValue: { fontSize: 10, color: "#dfe6f7" },

  page: {
    backgroundColor: COLORS.paper,
    color: COLORS.body,
    paddingTop: 54,
    paddingBottom: 62,
    paddingHorizontal: 54,
    fontSize: 10.5,
    lineHeight: 1.65,
  },

  runningHeader: {
    position: "absolute",
    top: 24,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
  },

  h1: { fontSize: 19, color: COLORS.ink, marginBottom: 14 },
  h2: { fontSize: 14, color: COLORS.ink, marginBottom: 8 },

  sectionHeaderRule: { height: 2, width: 40, backgroundColor: COLORS.primary, marginBottom: 12 },

  summaryBox: {
    backgroundColor: COLORS.paperSubtle,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    padding: 12,
    marginBottom: 14,
  },
  summaryText: { fontSize: 10, color: COLORS.body, fontStyle: "italic" },

  paragraph: { marginBottom: 9, textAlign: "justify" },

  highlightBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.paperSubtle,
    borderRadius: 3,
  },
  highlightTitle: { fontSize: 9, letterSpacing: 1.2, color: COLORS.premium, textTransform: "uppercase", marginBottom: 6 },
  highlightItem: { flexDirection: "row", marginBottom: 4 },
  highlightBullet: { width: 10, color: COLORS.primary },
  highlightText: { flex: 1, fontSize: 9.5 },

  factGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  factCell: {
    width: "50%",
    paddingVertical: 5,
    paddingRight: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e3e8f2",
  },
  factLabel: { fontSize: 8, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  factValue: { fontSize: 10, color: COLORS.ink, marginTop: 2 },

  disclaimerItem: { flexDirection: "row", marginBottom: 6 },
  disclaimerText: { flex: 1, fontSize: 8.5, color: COLORS.muted, lineHeight: 1.55 },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
    borderTopWidth: 0.5,
    borderTopColor: "#e3e8f2",
    paddingTop: 6,
  },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Splits model prose into paragraphs so long content stays readable. */
function paragraphsOf(content: string): string[] {
  return content
    .split(/\n{2,}|\r\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function RunningHeader({ document }: { document: ReportDocument }) {
  return (
    <View fixed style={styles.runningHeader}>
      <Text>RAVISH ASTRO</Text>
      <Text>{document.metadata.subjectName}</Text>
    </View>
  );
}

function Footer() {
  return (
    <View fixed style={styles.footer}>
      <Text>Prepared by Ravish Astro</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function ReportPdf({ document }: { document: ReportDocument }) {
  return (
    <Document
      author="Ravish Astro"
      subject={document.reportType}
      title={`${document.title} — ${document.metadata.subjectName}`}
    >
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverBrand}>Ravish Astro</Text>
        <Text style={styles.coverTitle}>{document.title}</Text>
        <Text style={styles.coverSubject}>Prepared for {document.metadata.subjectName}</Text>

        <View style={styles.coverRule} />

        {[
          ["Generated", formatDate(document.metadata.generatedAt)],
          ["Ayanamsa", document.metadata.ayanamsa],
          ["House system", document.metadata.houseSystem],
          ["Calculation", document.metadata.calculationVersion],
          ["Reference", document.metadata.astrologyCalculationId],
        ].map(([label, value]) => (
          <View key={label} style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>{label}</Text>
            <Text style={styles.coverMetaValue}>{value}</Text>
          </View>
        ))}
      </Page>

      <Page size="A4" style={styles.page}>
        <RunningHeader document={document} />

        <Text style={styles.h1}>Your Chart at a Glance</Text>
        <View style={styles.sectionHeaderRule} />

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>
            The values below are calculated, not interpreted. Everything later in this report is traditional
            commentary built on top of them.
          </Text>
        </View>

        <View style={styles.factGrid}>
          {document.calculatedFacts.map((fact) => (
            <View key={`${fact.label}-${fact.value}`} style={styles.factCell}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
            </View>
          ))}
        </View>

        <Text style={{ ...styles.h2, marginTop: 18 }}>Introduction</Text>
        {paragraphsOf(document.introduction).map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Footer />
      </Page>

      {document.sections.map((section) => (
        <Page key={section.id} size="A4" style={styles.page}>
          <RunningHeader document={document} />

          <Text style={styles.h1}>{section.title}</Text>
          <View style={styles.sectionHeaderRule} />

          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{section.summary}</Text>
          </View>

          {paragraphsOf(section.content).map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}

          {section.highlights.length > 0 ? (
            <View style={styles.highlightBox} wrap={false}>
              <Text style={styles.highlightTitle}>Key points</Text>
              {section.highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightItem}>
                  <Text style={styles.highlightBullet}>•</Text>
                  <Text style={styles.highlightText}>{highlight}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Footer />
        </Page>
      ))}

      <Page size="A4" style={styles.page}>
        <RunningHeader document={document} />

        <Text style={styles.h1}>In Closing</Text>
        <View style={styles.sectionHeaderRule} />

        {paragraphsOf(document.summary).map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Text style={{ ...styles.h2, marginTop: 22 }}>Please read</Text>
        {document.disclaimers.map((disclaimer, index) => (
          <View key={index} style={styles.disclaimerItem}>
            <Text style={{ ...styles.highlightBullet, color: COLORS.muted }}>•</Text>
            <Text style={styles.disclaimerText}>{disclaimer}</Text>
          </View>
        ))}

        <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 20 }}>
          Interpretation generated {formatDate(document.metadata.generatedAt)} using {document.metadata.aiProvider}/
          {document.metadata.aiModel}, prompt {document.metadata.promptVersion}, schema {document.schemaVersion}.
        </Text>

        <Footer />
      </Page>
    </Document>
  );
}

export class ReactPdfReportRenderer implements ReportRenderer {
  async render(document: ReportDocument) {
    const buffer = await renderToBuffer(<ReportPdf document={document} />);

    // Cover + facts page + one page per section + closing. Sections may overflow,
    // so this is a floor rather than an exact count.
    const pageCount = 3 + document.sections.length;

    return { bytes: new Uint8Array(buffer), mimeType: "application/pdf", pageCount };
  }
}

export function getReportRenderer(): ReportRenderer {
  return new ReactPdfReportRenderer();
}

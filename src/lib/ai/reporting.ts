import type { BirthDetails } from "@/lib/astrology/provider";
import type { ReportStatus } from "@/types/domain";

export type ReportJobStatus = ReportStatus;

export interface AIInterpretationProvider {
  generateReportInterpretation(input: {
    chartJson: unknown;
    reportType: string;
    birthDetails: BirthDetails;
  }): Promise<unknown>;
  answerAstrologyQuestion(input: { question: string; chartJson?: unknown }): Promise<unknown>;
}

export interface ReportRenderer {
  renderPdf(input: { reportId: string; interpretation: unknown }): Promise<{ objectKey: string }>;
}

export interface ReportStorage {
  createSignedUrl(objectKey: string): Promise<string>;
}

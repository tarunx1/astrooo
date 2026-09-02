# AI interpretation provider decision

Status: accepted — 2 September 2026
Scope: structured astrology report generation (Phase 2)

## Decision

Google **Gemini** (`gemini-2.5-flash` by default), selected via `AI_PROVIDER=gemini`
and reached through the `AIInterpretationProvider` interface.

The repository already carried `AI_PROVIDER_API_KEY` and an `AIInterpretationProvider`
stub with no vendor binding, so this formalises the existing direction rather than
introducing a new one. Domain code depends only on the interface; changing model or
vendor is a configuration change.

## What the model is and is not allowed to do

The pipeline is strictly:

```
BirthProfile -> immutable AstrologyCalculation -> normalized KundliResult
   -> ReportContextBuilder -> LLM -> structured interpretation
```

The model receives a chart that has **already been calculated** by VedAstro. It is
never asked to compute a position, house, nakshatra or dasha. Two structural
guarantees enforce this:

1. **The model only authors narrative.** `aiReportBodySchema` covers title,
   introduction, sections and summary. Nothing else. The `calculatedFacts` printed
   in the report and every metadata field are assembled from the calculation after
   the model returns, so a model cannot introduce a planetary position into a
   finished document even if it tries.
2. **The prompt never contains raw birth data.** The context carries the chart, not
   the date, time or coordinates. This is asserted in tests.

## Hallucination controls

Twelve explicit guardrails are prepended to every system prompt: use only supplied
data, never invent or recompute astronomy, separate fact from interpretation, no
medical diagnosis, no guaranteed financial outcome, no legal advice, no predicting
death or disaster, no fear-based superstition, no claims of scientific certainty, no
describing real third parties. Their presence is covered by tests across all five
report specs.

## Validation

Every response is parsed and validated against Zod before persistence. Output that
is not valid JSON, or that fails the schema, is a **failed generation** — never a
stored report. Markdown fences are tolerated; malformed structure is not.

## Reproducibility

Each `GeneratedReport` records `aiProvider`, `aiModel`, `promptVersion`,
`schemaVersion`, `astrologyCalculationId` and `generatedAt`, so any document can be
traced to the exact inputs and instructions that produced it.

## Prompts are per report type

There is deliberately no universal prompt. Each of the five report types declares
its own sections, focus and minimum context requirements in `src/lib/reports/specs.ts`.
A report whose chart lacks its required context is refused rather than generated thin.

## Job architecture

Long model calls never run in a customer request. `enqueueReportGeneration` is
called after the payment transaction commits, and a worker drains the queue via
`POST /api/jobs/reports`, protected by `JOBS_SECRET`. That endpoint is the seam a
real queue (BullMQ, Inngest, Trigger.dev, Cloud Tasks) would replace; the pipeline
does not care what invokes it.

Retries are bounded at 3 attempts. Only `transient` failures are retried; invalid
model output is terminal because it will not fix itself. Attempt count, last error
category and timestamp are recorded on every failure.

## Development provider

`AI_PROVIDER=development` returns deterministic placeholder text that states in
every section that it is not a real interpretation. It throws if `NODE_ENV` is
production, so it can never serve a paying customer.

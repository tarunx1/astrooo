"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { DashaTree, LordHouseLabel, type KpFormulaSelection } from "@/components/astrology/dasha-tree";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DASHA_LEVELS, buildDashaTimeline, dashaChainAt } from "@/lib/astrology/engine/dasha";

const STORAGE_KEY = "ravish-astro:kp-formulas:v1";
const RUNNING_DASHA_LEVELS = DASHA_LEVELS.slice(0, 3);

type KpFormula = KpFormulaSelection & {
  id: string;
};

export type RunningDashaLord = {
  lord: string;
  houses: number[];
};

export type RunningDashaFormulaRow = {
  level: string;
  periodLord?: string;
  dateLabel: string;
  dashaLord: RunningDashaLord | null;
  starLord: RunningDashaLord | null;
  subLord: RunningDashaLord | null;
};

export function DashaFormulaPanel({
  birthISO,
  houses = {},
  lordDetails = {},
  moonLongitude,
}: {
  birthISO: string;
  houses?: Record<string, number[]>;
  lordDetails?: Record<string, { starLord: string; subLord: string }>;
  moonLongitude: number;
}) {
  const nameId = useId();
  const housesId = useId();
  const selectId = useId();
  const dateId = useId();
  const [formulas, setFormulas] = useState<KpFormula[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [formulaName, setFormulaName] = useState("");
  const [houseInput, setHouseInput] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayInputValue);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStoredFormulas();
      setFormulas(stored);
      setSelectedId(stored[0]?.id ?? "");
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formulas));
  }, [formulas, loaded]);

  const selectedFormula = useMemo(
    () => formulas.find((formula) => formula.id === selectedId) ?? null,
    [formulas, selectedId],
  );
  const activeAt = useMemo(() => selectedDateToDate(selectedDate), [selectedDate]);
  const activeAtISO = activeAt.toISOString();
  const runningRows = useMemo(
    () => buildRunningRows({
      activeAt,
      birthISO,
      houses,
      lordDetails,
      moonLongitude,
    }),
    [activeAt, birthISO, houses, lordDetails, moonLongitude],
  );

  const addFormula = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseHouseInput(houseInput);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    const nextFormula: KpFormula = {
      id: `${Date.now()}-${parsed.houses.join("-")}`,
      name: formulaName.trim() || `KP ${parsed.houses.join(",")}`,
      houses: parsed.houses,
    };
    setFormulas((current) => [...current, nextFormula]);
    setSelectedId(nextFormula.id);
    setFormulaName("");
    setHouseInput("");
    setError("");
  };

  const deleteSelected = () => {
    if (!selectedFormula) return;
    setFormulas((current) => current.filter((formula) => formula.id !== selectedFormula.id));
    setSelectedId((current) => {
      const remaining = formulas.filter((formula) => formula.id !== current);
      return remaining[0]?.id ?? "";
    });
  };

  return (
    <>
      <form className="grid gap-3 rounded-md border border-border bg-background/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_auto] sm:items-end" onSubmit={addFormula}>
        <FormField id={nameId} label="Formula name">
          <Input
            id={nameId}
            onChange={(event) => setFormulaName(event.target.value)}
            placeholder="Career"
            value={formulaName}
          />
        </FormField>
        <FormField id={housesId} label="Houses" error={error}>
          <Input
            id={housesId}
            inputMode="numeric"
            onChange={(event) => {
              setHouseInput(event.target.value);
              setError("");
            }}
            placeholder="2,6,10,11"
            value={houseInput}
          />
        </FormField>
        <Button className="w-full sm:w-auto" size="md" type="submit" variant="premium">
          Add
        </Button>
      </form>

      {formulas.length > 0 ? (
        <div className="grid gap-3 rounded-md border border-border bg-background/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto_auto] sm:items-end">
          <FormField id={selectId} label="KP formula">
            <Select id={selectId} onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>
              {formulas.map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.name} ({formula.houses.join(",")})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id={dateId} label="Time frame">
            <Input
              id={dateId}
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          </FormField>
          <Button onClick={() => setSelectedDate(todayInputValue())} size="md" type="button" variant="secondary">
            Current
          </Button>
          <Button disabled={!selectedFormula} onClick={deleteSelected} size="md" type="button" variant="outline">
            Remove
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-md border border-border bg-background/30 p-3 sm:grid-cols-[minmax(0,0.7fr)_auto] sm:items-end">
          <FormField id={dateId} label="Time frame">
            <Input
              id={dateId}
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          </FormField>
          <Button onClick={() => setSelectedDate(todayInputValue())} size="md" type="button" variant="secondary">
            Current
          </Button>
        </div>
      )}

      <DashaTree
        activeAtISO={activeAtISO}
        birthISO={birthISO}
        houses={houses}
        key={activeAtISO}
        moonLongitude={moonLongitude}
        selectedFormula={selectedFormula}
      />

      <RunningDashaFormulaTable activeAt={activeAt} rows={runningRows} selectedFormula={selectedFormula} />
    </>
  );
}

function RunningDashaFormulaTable({
  activeAt,
  rows,
  selectedFormula,
}: {
  activeAt: Date;
  rows: RunningDashaFormulaRow[];
  selectedFormula: KpFormulaSelection | null;
}) {
  const highlightHouses = selectedFormula?.houses ?? [];
  const heading = isSameDate(activeAt, new Date()) ? "Running Now" : "Selected Time";

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface-raised/50">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <caption className="sr-only">
          Running Vimshottari dasha lords with each lord&apos;s KP star lord and sub lord
        </caption>
        <thead>
          <tr className="border-b border-border">
            {[heading, "Dasha Lord", "Star Lord", "Sub Lord"].map((columnHeading) => (
              <th
                className="px-3 py-2.5 caption uppercase tracking-[0.08em] text-foreground-muted"
                key={columnHeading}
                scope="col"
              >
                {columnHeading}
              </th>
            ))}
            {selectedFormula ? (
              <th className="px-3 py-2.5 text-center caption uppercase tracking-[0.08em] text-foreground-muted" scope="col">
                Match
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const matched = selectedFormula ? rowMatchesFormula(row, selectedFormula.houses) : false;

            return (
              <tr className="border-b border-border last:border-0" key={row.level}>
                <th className="px-3 py-3 text-left font-normal" scope="row">
                  <p className="body-sm font-semibold text-foreground">
                    {row.periodLord ? `${row.level} ${row.periodLord}` : row.level}
                  </p>
                  <p className="mt-1 caption text-foreground-muted">{row.dateLabel}</p>
                </th>
                <RunningDashaCell highlightHouses={highlightHouses} lord={row.dashaLord} />
                <RunningDashaCell highlightHouses={highlightHouses} lord={row.starLord} />
                <RunningDashaCell highlightHouses={highlightHouses} lord={row.subLord} />
                {selectedFormula ? (
                  <td className="px-3 py-3 text-center text-premium">
                    {matched ? <span aria-label="Formula combination exists">✓</span> : <span aria-hidden="true">—</span>}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RunningDashaCell({
  highlightHouses,
  lord,
}: {
  highlightHouses: number[];
  lord: RunningDashaLord | null;
}) {
  return (
    <td className="px-3 py-3">
      {lord ? (
        <LordHouseLabel
          className="block truncate body-sm font-semibold text-premium"
          highlightHouses={highlightHouses}
          houses={lord.houses}
          lord={lord.lord}
        />
      ) : (
        <span className="body-sm font-semibold text-premium">Not available</span>
      )}
    </td>
  );
}

function rowMatchesFormula(row: RunningDashaFormulaRow, formulaHouses: number[]) {
  const rowHouses = [row.dashaLord, row.starLord, row.subLord].flatMap((lord) => lord?.houses ?? []);
  return formulaHouses.every((house) => rowHouses.includes(house));
}

function buildRunningRows({
  activeAt,
  birthISO,
  houses = {},
  lordDetails = {},
  moonLongitude,
}: {
  activeAt: Date;
  birthISO: string;
  houses?: Record<string, number[]>;
  lordDetails?: Record<string, { starLord: string; subLord: string }>;
  moonLongitude: number;
}): RunningDashaFormulaRow[] {
  const birth = new Date(birthISO);
  const chain = dashaChainAt(buildDashaTimeline(birth, moonLongitude, RUNNING_DASHA_LEVELS.length), activeAt);
  const lordWithHouses = (lord?: string): RunningDashaLord | null =>
    lord ? { lord, houses: houses?.[lord] ?? [] } : null;

  return RUNNING_DASHA_LEVELS.map((level, index) => {
    const period = chain[index];
    const lords = period && lordDetails ? lordDetails[period.lord] : undefined;

    return {
      level,
      periodLord: period?.lord,
      dateLabel: period ? `${periodDate(period.start)} to ${periodDate(period.end)}` : "Not available",
      dashaLord: lordWithHouses(period?.lord),
      starLord: lordWithHouses(lords?.starLord),
      subLord: lordWithHouses(lords?.subLord),
    };
  });
}

function periodDate(date: Date) {
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", timeZone: "UTC" });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function selectedDateToDate(value: string) {
  return new Date(`${value || todayInputValue()}T12:00:00.000Z`);
}

function isSameDate(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function parseHouseInput(value: string): { ok: true; houses: number[] } | { ok: false; message: string } {
  const raw = value
    .split(/[\s,/-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (raw.length === 0) return { ok: false, message: "Add at least one house." };

  const houses = raw.map(Number);
  if (houses.some((house) => !Number.isInteger(house) || house < 1 || house > 12)) {
    return { ok: false, message: "Use house numbers from 1 to 12." };
  }

  return { ok: true, houses: [...new Set(houses)].sort((a, b) => a - b) };
}

function isFormula(value: unknown): value is KpFormula {
  if (!value || typeof value !== "object") return false;
  const formula = value as KpFormula;
  return (
    typeof formula.id === "string" &&
    typeof formula.name === "string" &&
    Array.isArray(formula.houses) &&
    formula.houses.every((house) => Number.isInteger(house) && house >= 1 && house <= 12)
  );
}

function readStoredFormulas() {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isFormula) : [];
  } catch {
    return [];
  }
}

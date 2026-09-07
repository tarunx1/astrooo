/**
 * Records reference positions from JPL Horizons.
 *
 * Horizons is a numerical integration of the real solar system, produced
 * independently of the analytic theories this engine evaluates. Agreeing with
 * it is the only evidence that matters: agreeing with our former provider
 * would prove only that we copied it, and agreeing with a worked example from
 * a textbook would prove only that we can transcribe.
 *
 * The values are recorded here rather than fetched during the test run, so the
 * suite stays offline, fast and deterministic. Re-run this script to refresh
 * them; the diff should be empty.
 *
 * Run with:  npx tsx scripts/astronomy/build-horizons-fixtures.ts
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "tests/fixtures/horizons-positions.json");

const HORIZONS_IDS: Record<string, string> = {
  sun: "10",
  moon: "301",
  mercury: "199",
  venus: "299",
  mars: "499",
  jupiter: "599",
  saturn: "699",
};

/**
 * Dates spread across the range a birth chart plausibly needs, plus J2000 as a
 * fixed point and two dates outside the observed delta-T record so the
 * fallback path is measured rather than assumed.
 */
const DATES = [
  "1912-04-15 02:20",
  "1947-08-15 00:00",
  "1950-03-14 06:30",
  "1969-07-20 20:17",
  "1985-11-02 21:15",
  "2000-01-01 12:00",
  "2012-12-21 11:11",
  "2026-09-07 09:00",
  "2035-02-18 17:45",
  "2050-06-21 00:00",
];

async function fetchOne(body: string, when: string) {
  const stop = new Date(new Date(`${when.replace(" ", "T")}:00Z`).getTime() + 3600000);
  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${HORIZONS_IDS[body]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${when}'`,
    STOP_TIME: `'${stop.toISOString().slice(0, 16).replace("T", " ")}'`,
    STEP_SIZE: "'1h'",
    QUANTITIES: "'31'",
  });

  const response = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
  if (!response.ok) throw new Error(`Horizons responded ${response.status} for ${body} ${when}`);
  const text = await response.text();
  const start = text.indexOf("$$SOE");
  const end = text.indexOf("$$EOE");
  if (start < 0 || end < 0) throw new Error(`no ephemeris block for ${body} ${when}`);

  const columns = text.slice(start + 5, end).trim().split("\n")[0].trim().split(/\s+/);
  const longitude = Number(columns[columns.length - 2]);
  const latitude = Number(columns[columns.length - 1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(`unparseable row for ${body} ${when}`);
  }
  return { longitude, latitude };
}

async function main() {
  const records: Record<string, Record<string, { longitude: number; latitude: number }>> = {};

  for (const when of DATES) {
    records[when] = {};
    for (const body of Object.keys(HORIZONS_IDS)) {
      records[when][body] = await fetchOne(body, when);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    console.log(when, "done");
  }

  const payload = {
    source: "JPL Horizons, https://ssd.jpl.nasa.gov/api/horizons.api",
    quantity: "apparent geocentric ecliptic longitude and latitude of date (QUANTITIES=31), degrees",
    center: "500@399 (geocentric)",
    retrieved: new Date().toISOString().slice(0, 10),
    positions: records,
  };
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${Object.keys(records).length} dates to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

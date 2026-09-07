/**
 * Checks the engine against JPL Horizons.
 *
 * Horizons is a numerical integration of the actual solar system, produced
 * independently of the analytic theories this engine evaluates. Agreeing with
 * it is the only evidence that matters: matching our own provider would only
 * prove we copied it, and matching a textbook example would only prove we can
 * transcribe.
 *
 * Run with:  npx tsx scripts/astronomy/verify-horizons.ts
 */
import { apparentPosition, type EphemerisBody } from "@/lib/astrology/engine/geocentric";
import { terrestrialTime } from "@/lib/astrology/engine/time";

const HORIZONS_IDS: Record<EphemerisBody, string> = {
  sun: "10",
  mercury: "199",
  venus: "299",
  mars: "499",
  jupiter: "599",
  saturn: "699",
};

const DATES = ["1950-03-14 06:30", "1985-11-02 21:15", "2000-01-01 12:00", "2026-09-07 09:00", "2050-06-21 00:00"];

async function horizons(body: EphemerisBody, when: string): Promise<{ longitude: number; latitude: number }> {
  const stop = new Date(new Date(`${when.replace(" ", "T")}:00Z`).getTime() + 3600000);
  const stopText = stop.toISOString().slice(0, 16).replace("T", " ");

  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${HORIZONS_IDS[body]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${when}'`,
    STOP_TIME: `'${stopText}'`,
    STEP_SIZE: "'1h'",
    QUANTITIES: "'31'",
  });

  const response = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
  const text = await response.text();
  const rows = text.slice(text.indexOf("$$SOE") + 5, text.indexOf("$$EOE")).trim().split("\n");
  const columns = rows[0].trim().split(/\s+/);
  return { longitude: Number(columns[columns.length - 2]), latitude: Number(columns[columns.length - 1]) };
}

function arcseconds(a: number, b: number): number {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff <= -180) diff += 360;
  return diff * 3600;
}

async function main() {
  const bodies = Object.keys(HORIZONS_IDS) as EphemerisBody[];
  let worst = 0;
  let worstLabel = "";

  console.log("body      date               ours          horizons      diff (arcsec)");
  for (const when of DATES) {
    for (const body of bodies) {
      const jdTT = terrestrialTime(new Date(`${when.replace(" ", "T")}:00Z`));
      const ours = apparentPosition(body, jdTT);
      const reference = await horizons(body, when);
      const delta = arcseconds(ours.longitude, reference.longitude);
      if (Math.abs(delta) > Math.abs(worst)) {
        worst = delta;
        worstLabel = `${body} ${when}`;
      }
      console.log(
        `${body.padEnd(9)} ${when}  ${ours.longitude.toFixed(6).padStart(11)}  ${reference.longitude
          .toFixed(6)
          .padStart(11)}  ${delta.toFixed(3).padStart(9)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  console.log(`\nworst: ${worst.toFixed(3)} arcsec (${worstLabel})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

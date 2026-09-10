# Astrology Engine Decision

Date: 2026-09-07

Supersedes [Astrology Provider Decision](astrology-provider-decision.md).

## Decision

Astronomical positions are calculated inside this application. There is no
astrology API, no API key, no rate limit and no external dependency that can
fail or change under us.

- Planets: **VSOP87D** (Bretagnon & Francou, Bureau des Longitudes)
- Moon: **ELP 2000-82B** (Chapront-Touze & Chapront), constants fitted to
  JPL DE200/LE200
- Delta-T: **IERS** observed record from 1973, Espenak & Meeus outside it
- Ayanamsa: **Lahiri**, anchored at J2000 and carried by general precession
- Houses: whole-sign by default; Placidus, Porphyry and equal also available

## Why

The API was a single point of failure for the product's core function, capped
at five requests a minute, and unverifiable. It also turned out to be wrong:
one stored chart carried the nakshatra "Ashwini" - the first of the twenty-seven,
the value a failed lookup falls back to - for four planets whose own stored
longitudes were 102 to 144 degrees away from it. Those charts had been served to
users. Recomputing them locally fixes them.

Calculating locally also made Placidus cusps available, which is what KP cuspal
sub-lords require and what the API could not supply: its `AllHouseData` returned
Porphyry/Sripati cusps, measurable by dividing the ascendant-to-IC arc in three.

## How it is verified

Against **JPL Horizons**, an independent numerical integration of the real solar
system. Agreeing with the former provider would only show that we had copied it.

- Through the observed delta-T era, the worst disagreement across seven bodies
  and eight dates is under **0.6 arcseconds**.
- Beyond it, where delta-T is extrapolated, the fastest bodies reach about two
  arcseconds.
- For scale, the finest division this product reads is a KP sub-sub lord at
  roughly **578 arcseconds**.

Reference values are recorded in `tests/fixtures/horizons-positions.json` so the
suite stays offline; `scripts/astronomy/build-horizons-fixtures.ts` refreshes
them and should produce an empty diff.

Corroborating checks that do not involve Horizons:

- Differencing seven of the former provider's planets against our tropical
  positions implies a Lahiri ayanamsa of 23.8794 degrees for 2001-11-27. Our
  independent value is 23.8798.
- Our mean lunar node lands on the provider's stored Rahu to 0.002 degrees.
- Our ascendant lands on its stored ascendant to 0.003 degrees.
- Sunrise and sunset match published times to the minute.
- Panchang tithis match public festival dates, which owe nothing to this project.

Geometry is checked structurally rather than by remembered numbers: the
ascendant must sit on the horizon, the midheaven on the meridian, and Placidus
must collapse to exact 30-degree steps of right ascension at the equator.

## Where the coefficients come from

Fetched from the CDS archive by the generators in `scripts/astronomy/`, never
transcribed - these are tens of thousands of constants, and a hand-copied one is
a silent wrong answer for the life of the product. The generators verify what
they parse: every VSOP87 block is checked against its own declared term count.

- VSOP87: <https://cdsarc.cds.unistra.fr/ftp/VI/81/>
- ELP 2000-82B: <https://cdsarc.cds.unistra.fr/ftp/VI/79/>
- Delta-T: IERS `finals.all` and the IANA leap second list

VSOP87 is truncated at an amplitude of 1e-8, keeping 9000 of 25659 terms for a
worst-case error of 0.052 arcseconds, measured against the untruncated series
over 1700-2300 rather than assumed. ELP is kept whole.

## Known limits

- **Ashtakoota is partial by choice.** Four of the eight kootas are calculated -
  Varna, Tara, Bhakoot and Nadi, three of them pure arithmetic. Vashya, Yoni,
  Graha Maitri and Gana need lookup tables that differ between sources, and no
  authority comparable to Horizons exists to check them against, so they return
  null rather than a number that would look equally authoritative. The former
  provider scored only three of the eight.
- **Yogas are not detected.** Unchanged from before.
- **Manglik** uses the placement of Mars alone, without the exceptions and
  cancellations a practitioner would apply.
- **Lunar month, moonrise and Choghadiya** are not calculated.
- **Placidus is undefined inside the polar circles** and refuses rather than
  returning a plausible cusp.
- Delta-T beyond the observed record is extrapolation, which is the dominant
  error term for future dates.

## Calculation version

`tarun-kundli-v2.0`. Charts stored under `v1.1` were calculated by the previous
provider and must not be compared with new ones.

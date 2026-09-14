# Astrology methodology

Status: accepted — 14 September 2026
Implementation: `src/lib/astrology/`

Classical astrology has genuine variants. The same birth data, computed under
two respectable traditions, gives two different answers — and neither is a bug.
This document records **which variant this software follows**, so a result can
be checked against a stated method rather than against an assumption.

Where a variant was chosen, the alternative is named. Where a calculation is not
implemented, it is listed as not implemented rather than approximated.

## Foundations

| Setting | Value | Where |
| --- | --- | --- |
| Zodiac | Sidereal | `astrologyCalculationConfig.zodiac` |
| Ayanamsa | Lahiri (Chitrapaksha) | `astrologyCalculationConfig.ayanamsa` |
| House system | Whole sign | `astrologyCalculationConfig.houseSystem` |
| Engine version | `tarun-kundli-v2.0` | `astrologyCalculationConfig.version` |

**Ayanamsa.** Lahiri is the Indian government's Rashtriya Panchang standard and
every calculation stored so far uses it. The choice is named rather than assumed
because **Krishnamurti Paddhati is traditionally worked in its own ayanamsa**,
which differs from Lahiri by a few arcminutes. That sounds negligible and is
not: a KP sub-sub division spans about 10 arcminutes, so a shift of that size
changes sub-sub lords routinely.

**Engine version.** Bumped whenever a change would move a placement. Charts
stored under an older version were calculated differently and must not be
compared to new ones, nor silently recalculated. See `CalculationMetadata`.

## Shodashvarga — the sixteen divisional charts

Implementation: `src/lib/astrology/charts/varga.ts`
Tests: `tests/varga.test.ts`, `tests/divisional-charts.test.ts`

Every varga is derived from the **longitude**, never from the D1 house number.
A house is a function of the ascendant; a varga is a property of where the
planet actually is. Deriving from the house would make a planet's D9 change
because someone was born ten minutes later, which is not what a varga means.

The varga **ascendant** is the division of the exact rising degree. A sign alone
cannot produce it — Aries rising at 2° and at 28° give different D9 ascendants —
so a divisional chart is refused outright when only the ascendant sign is known,
rather than charting the sign's first division as though it were the answer.

Degrees are **scaled**, not carried across. A navamsa is 3°20' of the rashi and
the D9 spreads that arc across a whole sign, so a planet 1°40' into its navamsa
sits at 15° of the D9 sign. Carrying the rashi degree over would pair a degree
with a sign it does not describe.

| Varga | Parts | Starting sign | Step |
| --- | --- | --- | --- |
| D1 Rashi | 1 | the sign itself | — |
| D2 Hora | 2 (15° each) | odd: Leo then Cancer; even: Cancer then Leo | — |
| D3 Drekkana | 3 | the sign itself | **4** (1st, 5th, 9th) |
| D4 Chaturthamsha | 4 | the sign itself | **3** (1st, 4th, 7th, 10th) |
| D7 Saptamsha | 7 | odd: the sign; even: the 7th from it | 1 |
| D9 Navamsha | 9 | movable: itself; fixed: 9th; dual: 5th | 1 |
| D10 Dashamsha | 10 | odd: the sign; even: the 9th from it | 1 |
| D12 Dwadashamsha | 12 | the sign itself | 1 |
| D16 Shodashamsha | 16 | movable: Aries; fixed: Leo; dual: Sagittarius | 1 |
| D20 Vimshamsha | 20 | movable: Aries; fixed: Sagittarius; dual: Leo | 1 |
| D24 Chaturvimshamsha | 24 | odd: Leo; even: Cancer | 1 |
| D27 Saptavimshamsha | 27 | fire: Aries; earth: Cancer; air: Libra; water: Capricorn | 1 |
| D30 Trimshamsha | 5, **unequal** | see below | — |
| D40 Khavedamsha | 40 | odd: Aries; even: Libra | 1 |
| D45 Akshavedamsha | 45 | movable: Aries; fixed: Leo; dual: Sagittarius | 1 |
| D60 Shashtiamsha | 60 | the sign itself | 1 |

### Two cases that are not a plain equal division

**D3 and D4 do not step to the adjacent sign.** A Drekkana runs to the 5th and
the 9th from its sign; a Chaturthamsha to the 4th, 7th and 10th. Implementing
these as "next sign along" is a silent error that no type check would catch, so
each carries an explicit `step` and a test asserting the classical targets.

**D30 Trimshamsha is genuinely unequal.** Its five parts belong to the five
non-luminaries — the Sun and Moon take no trimshamsha — and the order reverses
between odd and even signs. Each lord contributes the sign of its own parity.

| Odd sign | Degrees | Lord → sign |
| --- | --- | --- |
| 1 | 0–5 | Mars → Aries |
| 2 | 5–10 | Saturn → Aquarius |
| 3 | 10–18 | Jupiter → Sagittarius |
| 4 | 18–25 | Mercury → Gemini |
| 5 | 25–30 | Venus → Libra |

| Even sign | Degrees | Lord → sign |
| --- | --- | --- |
| 1 | 0–5 | Venus → Taurus |
| 2 | 5–12 | Mercury → Virgo |
| 3 | 12–20 | Jupiter → Pisces |
| 4 | 20–25 | Saturn → Capricorn |
| 5 | 25–30 | Mars → Scorpio |

A test asserts a D30 never yields Cancer or Leo, since a luminary sign appearing
would prove the table wrong.

### Variants not taken

- **D60** is counted forward from the sign itself for both odd and even signs.
  Some traditions reverse the count for even signs. The forward count is the
  more widely implemented reading and is what this software uses.
- **D27** starts from the element's own sign. A simpler "count continuously from
  Aries" rule also circulates; it is not used here.

### Boundary handling

A boundary such as 3°20' is 3.3333… in binary, and a provider may hand over a
value a hair under it. Without a nudge the planet lands one part early — which
in a D60 is a whole sign. Values within `1e-9` of a boundary are snapped onto
it. Tests cover this directly.

## Vimshottari dasha

Implementation: `src/lib/astrology/engine/dasha.ts`
Tests: `tests/dasha.test.ts`

- Cycle: 120 years, nine lords in fixed proportion.
- Dasha year: **365.25 days**.
- Starting point: the lord of the Moon's nakshatra at birth, entered part-way
  through. The timeline is laid out from where that period actually began —
  before the birth — and the balance is reported separately. Starting at the
  birth instant would make the first mahadasha look short.
- Levels: Mahadasha, Antardasha, Pratyantardasha, Sookshma. The UI shows the
  first **three**; the engine computes four.
- Sub-periods are subdivided on demand. Four levels is over seven thousand
  periods and a reader opens perhaps a dozen.

## Yogini dasha

Implementation: `src/lib/astrology/charts/yogini-dasha.ts`
Tests: `tests/yogini-dasha.test.ts`

**Deliberately kept apart from Vimshottari.** The two share nothing but a
365.25-day dasha year. Yogini runs eight periods of one to eight years —
1+2+…+8 = **36 years** — and then simply repeats. There is no proportional
subdivision and no 120-year span, so it is presented as a plain sequence rather
than a tree; forcing it into the Vimshottari layout would imply a structure it
does not have.

| Yogini | Lord | Years |
| --- | --- | --- |
| Mangala | Moon | 1 |
| Pingala | Sun | 2 |
| Dhanya | Jupiter | 3 |
| Bhramari | Mars | 4 |
| Bhadrika | Mercury | 5 |
| Ulka | Saturn | 6 |
| Siddha | Venus | 7 |
| Sankata | Rahu | 8 |

The starting yogini comes from the birth nakshatra: `(nakshatra + 2) mod 8`. The
**+3 offset** (written as +2 on a zero-based index) is traditional and is what
makes Ashwini begin in Bhramari rather than at the head of the list.

The balance at birth is a fraction of the starting yogini's own span, taken from
how far the Moon has crossed its nakshatra — the same measure Vimshottari uses,
applied to a different cycle. As there, the timeline is laid out from where the
first period actually began, before the birth, so it is not reported short.

## Ashtakavarga

Implementation: `src/lib/astrology/charts/ashtakavarga.ts`
Tests: `tests/ashtakavarga.test.ts`

**Contributors: eight.** The seven planets — Sun, Moon, Mars, Mercury, Jupiter,
Venus, Saturn — plus the **Lagna**. **Rahu and Ketu take no part.** The system is
built on eight contributors and the nodes are not among them; including them
would change every total and make results incomparable with any other source. A
test asserts the nodes are ignored even when present in the chart.

**Houses are 1-based and inclusive.** The 1st house from a contributor is the
sign that contributor occupies, so the offset applied is `house - 1`. A test
pins this directly, because an off-by-one here shifts every sheet by a sign and
still produces plausible-looking numbers.

**Bhinnashtakavarga** is one planet's sheet: for each of the eight contributors,
a point is awarded to a fixed set of houses counted from that contributor. The
benefic-place tables are the whole method — the calculation is a single loop,
and everything Parashari about it lives in the data.

**Sarvashtakavarga** is the seven sheets added sign by sign.

### Self-checking totals

A planet's total does **not** depend on the chart: each contributor awards a
fixed number of points wherever it sits, so these are constants of the system
rather than results.

| Planet | Total |
| --- | --- |
| Sun | 48 |
| Moon | 49 |
| Mars | 39 |
| Mercury | 54 |
| Jupiter | 56 |
| Venus | 52 |
| Saturn | 39 |
| **Sarvashtakavarga** | **337** |

337 is the figure every classical source gives. This is the sharpest available
check on the tables: a single mistyped house changes a total, and the tests
assert all eight figures hold across many rotated charts. That is why
Ashtakavarga was implemented before Shadbala — it can be proved self-consistent
without external reference data.

### Prasthara

The Bhinnashtakavarga **with its working shown**: which of the eight
contributors gave each bindu. A sheet says a sign has five; the prasthara says
*which five*, which is what tells an astrologer whether a count is well-founded
or propped up by a single reference point.

The grid **checks itself**: its columns sum to the Bhinnashtakavarga by
construction, and that in turn is checked against the classical total. A mistake
cannot hide in one cell.

**The shodhana is not implemented.** The Trikona and Ekadhipatya reductions
applied *to* this grid have genuinely variant readings. The grid itself is only
the data the sheet was already built from and cannot be contentious — which is
the distinction an earlier draft of this document blurred by calling the whole
of Prasthara unimplemented.

## Planetary friendship and dignity

Implementation: `src/lib/astrology/charts/relationships.ts`, `dignity.ts`
Tests: `tests/relationships.test.ts`

**Rahu and Ketu are excluded** from the friendship tables. The classical
naisargika maitri table is built on the seven planets, and the readings given
for the nodes vary by author — offering one would present a choice as though it
were the tradition. Same restriction, same reason, as Ashtakavarga.

**Natural (naisargika)** is a constant of the system. The Moon has **no natural
enemies** — a property of the tradition, not an omission. The table is **not
symmetric**: Mercury counts the Moon an enemy while the Moon counts Mercury a
friend, and a test pins that asymmetry so it cannot be "tidied up".

**Temporal (tatkalika)** depends only on this chart: a planet in the 2nd, 3rd,
4th, 10th, 11th or 12th from another is its temporal friend, the rest are
enemies. The division is **exhaustive — there is no temporal neutral**, which is
why the type has two values and not three.

**Compound (panchadha maitri)** adds the two rather than letting one override:

| Natural | Temporal | Compound |
| --- | --- | --- |
| friend | friend | great friend |
| friend | enemy | neutral |
| neutral | friend | friend |
| neutral | enemy | enemy |
| enemy | friend | neutral |
| enemy | enemy | great enemy |

### Dignity

Resolved in strict order: exaltation and debilitation, then moolatrikona, then
own sign, then the natural relationship with the sign's lord. A planet in its
own sign is never reported as being in a friend's sign.

Debilitation is the exaltation degree of the opposite sign. Exaltation is
reported at two strengths — the sign, and whether the planet stands at its exact
degree — because reporting only the sign loses the distinction the tradition
draws between exalted and deeply exalted.

| Planet | Exaltation | Moolatrikona |
| --- | --- | --- |
| Sun | Aries 10° | Leo 0–20° |
| Moon | Taurus 3° | Taurus 4–30° |
| Mars | Capricorn 28° | Aries 0–12° |
| Mercury | Virgo 15° | Virgo 16–20° |
| Jupiter | Cancer 5° | Sagittarius 0–10° |
| Venus | Pisces 27° | Libra 0–15° |
| Saturn | Libra 20° | Aquarius 0–20° |

**Nothing here judges.** "Debilitated" is a position, not a verdict, and no
favourable/unfavourable flag is produced. What a debilitated planet means
belongs to interpretation, not to a calculation.

### Combustion

Measured as the **shorter arc** to the Sun, so a planet just ahead and one just
behind are treated alike. The Sun is never combust and the nodes have no orb.

| Planet | Orb | Retrograde |
| --- | --- | --- |
| Moon | 12° | — |
| Mars | 17° | — |
| Mercury | 14° | 12° |
| Jupiter | 11° | — |
| Venus | 10° | 8° |
| Saturn | 15° | — |

Mercury and Venus are the only planets whose orb depends on motion as well as
distance.

## Graha drishti (aspects)

Implementation: `src/lib/astrology/charts/aspects.ts`
Tests: `tests/aspects.test.ts`

Counted in **whole signs, not degrees**. A Vedic aspect lands on a sign or it
does not — there is no orb and no partial case to interpolate, which is why this
is a table rather than an angular calculation.

| Planet | Aspects |
| --- | --- |
| Sun, Moon, Mercury, Venus | 7th |
| Mars | 4th, 7th, 8th |
| Jupiter | 5th, 7th, 9th |
| Saturn | 3rd, 7th, 10th |
| Rahu, Ketu | none |

**The nodes cast nothing.** They own no sign, and the tradition reads what
aspects *them* rather than what they aspect. Some later authors give the nodes
aspects of their own; that is a choice, not the classical rule, and it is not
made here. A node can still be aspected, and is.

This table is the **single definition** in the codebase. `kp/significators.ts`
reads it too, so the KP view and the Parashari view cannot drift into
disagreeing about who aspects whom.

### Graded drishti

Parashara does not treat every aspect as equal. By house distance:

| Distance | Virupas |
| --- | --- |
| 3rd, 10th | 15 (quarter) |
| 5th, 9th | 30 (half) |
| 4th, 8th | 45 (three quarters) |
| 7th | 60 (full) |

The special aspects of Mars (4th, 8th), Jupiter (5th, 9th) and Saturn (3rd,
10th) are **full** where an ordinary planet's would be partial — which is
precisely what makes them special.

**The house table is what is implemented.** Parashara also gives a degree-based
interpolation grading an aspect continuously between houses; that formula has
variant readings and is not applied. An aspect lands on a whole sign, at one of
the four strengths above.

## Kaal Sarp

Implementation: `src/lib/astrology/charts/kaal-sarp.ts`
Tests: `tests/kaal-sarp-navatara.test.ts`

Rahu and Ketu are always opposite, so they cut the zodiac in two. The yoga holds
when all seven planets fall in the half running **forward from Rahu to Ketu** in
increasing longitude.

- A planet **exactly on a node** counts as inside the arc. The alternative is to
  declare a chart free of the yoga on a hair of floating-point rounding.
- The **mirror case** — everything in the Ketu-to-Rahu half — is reported
  separately, not folded in. Several authors call it Kaal Amrit; calling it Kaal
  Sarp would answer a different question.
- The twelve traditional names index from the house Rahu occupies (1st Ananta
  through 12th Sheshnag) and are given **only when the yoga is actually
  present**.

Partial or *anshik* forms are **not implemented**. The readings for a planet
near the axis vary by author, and a maybe is not worth printing.

Nothing about severity or remedy is produced. The yoga has a fearsome
reputation and the calculation has none: it either holds or it does not.

## Navatara

Implementation: `src/lib/astrology/charts/navatara.ts`

Counted **inclusively** from the birth nakshatra, which is itself the first —
Janma. Every ninth returns to the same tara, so the twenty-seven fall into nine
groups recurring three times, and the cycle number is reported alongside.

Janma · Sampat · Vipat · Kshema · Pratyari · Sadhaka · Naidhana · Mitra ·
Parama Mitra.

The names carry strong associations and **none of them are encoded**. A tara is
a position in a cycle; what it means belongs to a reading. A test asserts each
tara covers exactly three nakshatras and that all twenty-seven appear once.

## Jaimini

Implementation: `src/lib/astrology/charts/jaimini.ts`
Tests: `tests/jaimini.test.ts`

### Chara Karakas — the eight-karaka scheme

Planets are ranked by **degree within sign**, descending. The furthest through
its sign is the Atmakaraka, and the rest follow:

Atmakaraka · Amatyakaraka · Bhratrikaraka · Matrikaraka · Putrakaraka ·
Pitrikaraka · Gnatikaraka · Darakaraka

**Rahu is counted in reverse** — 30 minus its degree — because it moves
backwards through the zodiac, so the sign it has travelled furthest through is
the one it has least of remaining. **Ketu takes no karaka.**

**The fork:** this software uses the **eight-karaka scheme including Rahu**. A
seven-karaka scheme excluding Rahu is equally current; it drops Putrakaraka and
shifts the rest up, so the two give *different karakas for the same chart*. They
are not combined, and the alternative is not offered silently.

Exact ties are broken by planet name, so the ordering can never depend on the
order the planets happened to arrive in.

### Karakamsa and Swamsa

Both rest on one value: the sign the **Atmakaraka occupies in the Navamsa**. The
difference is only which chart that sign is read as the lagna of.

| Name | Read as the lagna of |
| --- | --- |
| Karakamsa | the **Rashi** chart |
| Swamsa | the **Navamsa** chart |

**These two names are used inconsistently in the literature and some authors
swap them outright.** The definitions above are the ones this software uses,
stated in the panel as well as here, so a reader is never left to infer which
convention is in force. Nothing is recalculated for either chart — only the
reference point moves.

### Arudha Padas

Count from a house to its lord, then the same distance again from the lord —
both counts inclusive, so a lord in its own sign is a distance of 1.

**The exception:** a pada may not rest in the house itself or in the seventh
from it — a reflection cannot fall on its own source or directly opposite it. In
either case it moves to the **tenth** from where it landed. A test asserts this
holds across all 144 house/lord combinations, so no pada can ever be left in a
forbidden place.

A1 is the **Arudha Lagna** and A12 the **Upapada**; the rest go by number.
Padas that were moved by the exception are marked as such in the UI, since an
unexplained jump looks like an error.

## Natural benefic and malefic

Implementation: `src/lib/astrology/charts/benefic.ts`
Tests: `tests/benefic.test.ts`

Five are fixed — Jupiter and Venus benefic; the Sun, Mars, Saturn and both nodes
malefic. **Two depend on the chart**, which is why this is a calculation and not
a lookup:

| Planet | Benefic when | Judged by |
| --- | --- | --- |
| Moon | Waxing | Elongation from the Sun below 180° |
| Mercury | Alone or with benefics | Malefics sharing its sign |

Both conditions are computed from positions already known, so neither is
guessed, and each carries its reason (`Waxing — 94.2° from the Sun`).

**A variant not taken:** some authorities weaken the Moon further when it is
close to the Sun regardless of fortnight — within 72° on one common reckoning —
and would call such a Moon malefic even while waxing. That refinement is not
applied. The plain paksha rule is, and `moonElongation` is exported so a caller
with a different threshold has the number rather than this module's verdict.

This is the classification **Drik Bala needs**. It is not Drik Bala: that also
requires Parashara's graded aspect scale, which remains unimplemented.

## Avasthas — Baaladi

Implementation: `src/lib/astrology/charts/avastha.ts`
Tests: `tests/avastha.test.ts`

The sign is cut into five equal parts of six degrees: **Baala, Kumara, Yuva,
Vriddha, Mrita**.

**In an odd sign the sequence runs forward; in an even sign it runs backwards.**
A planet at 0° of Taurus is Mrita and one at 29° is Baala. That reversal is the
whole subtlety of the technique — software that forgets it reports exactly the
wrong avastha for half of all placements, and the output still looks entirely
reasonable. A test asserts the two halves sum to a constant across every degree.

The nodes take no avastha: they are shadow points, not bodies with an age.

Only the **Baaladi** states are calculated. Deeptaadi (the twenty states from
dignity and aspect) and the Jagradi triad are not implemented — the rules for
combining them vary and a partial set would be worse than none.

The names are positions in a cycle. `Mrita` means the last sixth of the sign,
not that anything is dead.

## Yogas

Implementation: `src/lib/astrology/charts/yogas.ts`
Tests: `tests/yogas.test.ts`

A **rule engine**, not yogas written into a component. Each rule declares a
condition and returns the **evidence** that matched, so a reading can say why a
yoga was reported rather than asking anyone to take it on trust.

| Yoga | Condition |
| --- | --- |
| Ruchaka, Bhadra, Hamsa, Malavya, Sasa | Mars / Mercury / Jupiter / Venus / Saturn dignified **and** in an angle |
| Sunapha, Anapha, Durudhara | The 2nd, the 12th, or both from the Moon occupied |
| Gajakesari | Jupiter in the 1st, 4th, 7th or 10th from the Moon |
| Budha-Aditya | Mercury and the Sun in the same sign |
| Chandra-Mangala | The Moon and Mars in the same sign |
| Kemadruma | No planet in the 2nd or 12th from the Moon, excluding the Sun and the nodes |
| Vipareeta Raja | A lord of the 6th, 8th or 12th placed in *another* of those three |
| Neecha Bhanga | A debilitated planet whose dispositor sits in an angle from the ascendant |
| Kendra Trikona Raja | An angle lord and a trine lord conjunct or in mutual aspect |

**The list is deliberately short.** Classical texts name hundreds of yogas, many
with conflicting definitions. A long list of loosely-implemented ones is worth
less than a short list that is right, so a rule is added **with its tests or not
at all**.

Rules that do not fire are still shown in the UI, greyed. "Gajakesari was
checked and is not present" is information; an absent row is not — and it makes
the limits of the engine visible, since nothing outside this list has been
looked for.

Sunapha, Anapha, Durudhara and Kemadruma are **exhaustive and mutually
exclusive** by construction — the 2nd and 12th from the Moon are each occupied
or not, which is four cases and no more. A test asserts exactly one of the four
holds in any chart, so a drifting rule cannot go unnoticed.

There is no "likely" and no partial credit: a yoga is reported only when its own
condition holds.

## Krishnamurti Paddhati

Implementation: `src/lib/astrology/kp/`

- House system for KP: Placidus cusps (distinct from the whole-sign houses used
  for the Parashari chart).
- Lords: star lord, sub lord, sub-sub lord.
- Ayanamsa: currently Lahiri. **This is a known divergence** — see Foundations.

## KP Ruling Planets

Implementation: `src/lib/astrology/kp/ruling-planets.ts`
Tests: `tests/ruling-planets.test.ts`

Seven contributions from five sources:

1. The **Ascendant's** sign lord, star lord and sub lord
2. The **Moon's** sign lord, star lord and sub lord
3. The lord of the **weekday**

A planet named by more than one source is **stronger for it**, so the count is
kept rather than collapsed to a set. "Venus appears three times" is the
substance of the technique; a list of unique names discards it.

**This is the five-source form.** Some practitioners add a node occupying the
sign of a ruling planet, and others include the lord of the hora. Neither is
applied here — both are elaborations that are not universally used, and adding
one silently would hand back a different technique under the same name.

**A stated limit:** a Vedic day runs sunrise to sunrise, so a birth between
midnight and dawn belongs to the *previous* weekday. The day lord here is taken
from the **civil** day. That boundary is recorded rather than fudged, because
silently shifting the day would be the worse surprise.

## Planetary strength — partial

Implementation: `src/lib/astrology/charts/bala.ts`
Tests: `tests/bala.test.ts`

**This is not Shadbala, and is never labelled as such.** Shadbala is the sum of
six balas; two of them rest on conventions that genuinely differ between
authorities. A total assembled from some defensible parts and some guessed ones
is worth less than no total, because nothing in the number says which is which.

So the components with one unambiguous reading are calculated, named
individually, and **not added into a Shadbala figure**. A test asserts the
module exports no `shadbalaTotal` and no `calculateShadbala`, so the omission
cannot be undone by accident.

### Implemented

| Component | Rule | Range |
| --- | --- | --- |
| Naisargika | Fixed ranking, Sun strongest | 8.57–60 |
| Saptavargaja | Compound dignity across D1, D2, D3, D7, D9, D12, D30 | 13.1–315 |
| Uchcha | Shorter arc from the debilitation point ÷ 3 | 0–60 |
| Kendradi | Angle 60, succedent 30, cadent 15 | 15–60 |
| Dig | Linear from the planet's own direction | 0–60 |
| Ojhayugmarasyamsa | Odd/even in rashi and navamsa, 15 each | 0–30 |
| Drekkana | Male 1st, neuter 2nd, female 3rd third | 0 or 15 |
| Drik | Benefic virupas less malefic, ÷ 4 | can be negative |

Units are **Shashtiamsas** (sixtieths); one rupa is 60.

Naisargika is self-checking: the values are exactly 60k/7 for k = 7 down to 1,
so a mistyped figure would not be a multiple of 60/7. A test asserts that.

**Saptavargaja** scores the planet's standing in each of seven divisions and
adds them. The weights are the BPHS table, halving down the scale from own sign:

| Standing | Weight |
| --- | --- |
| Moolatrikona | 45 |
| Own sign | 30 |
| Great friend | 22.5 |
| Friend | 15 |
| Neutral | 7.5 |
| Enemy | 3.75 |
| Great enemy | 1.875 |

Relationship with a varga sign's lord is the **compound** one, and temporal
friendship is read from the **rashi** chart — a varga is a mapping of
longitudes, not a second sky with its own proximities.

An earlier draft of this document called these weights unsettled. They are not.
What was actually missing was the compound-friendship input, which the
relationships module now supplies; the correction is recorded here rather than
quietly fixed.

**Drik Bala** is the virupas cast on a planet by benefics less those cast by
malefics, divided by four. It is **not clamped at zero**: a planet under heavy
malefic aspect has a negative Drik Bala, and that is a real result.

Both of its inputs were deferred once and are now calculable — the graded
drishti table, and the benefic classification with the Moon and Mercury judged
in context.

### Not implemented, and why

- **Kala Bala** — its sub-components rest on epoch conventions that differ by
  authority (which epoch a year-lord counts from, how a planetary war is scored)
- **Chesta Bala** — needs true motion compared against mean motion

The UI states all four omissions on the panel itself, beside the partial sum, so
the figure cannot be mistaken for a Shadbala value from another program.

## Not implemented

Listed so their absence is a recorded decision rather than an oversight. None of
these are approximated, estimated, or generated by a language model.

- Ashtakavarga **shodhana** — the Trikona and Ekadhipatya reductions (the Prasthara grid itself is implemented)
- **Shadbala as a whole**, and Bhava Bala. Eight components are implemented and named individually — see below — but the total is deliberately not produced, because Kala Bala and Chesta Bala are still missing.
- Deeptaadi and Jagradi avasthas (Baaladi is implemented — see above)
- Char dasha (Yogini dasha is implemented — see above)
- Ishta Devata — **methodology review required** before any implementation
- Lal Kitab — a separate methodology, not Parashari houses with different text
- Varshphal / Tajik

## Validation status

The varga rules are **implemented and internally consistent**: tests assert the
encoded rules are applied correctly, including boundary and wrap cases, and that
the generic D9 agrees with the pre-existing navamsa implementation across the
whole zodiac.

The **ephemeris underneath is independently validated**: `astronomy-engine.test.ts`
checks planetary positions against JPL Horizons to well under an arcsecond
through the observed era. So a planet is where this software says it is.

The **classical rule layer on top is not yet externally validated**. The vargas,
the dasha arithmetic and the friendship tables are internally consistent and,
in Ashtakavarga's case, self-proving via the 337 invariant — but no external
reference confirms that the rules encoded are the rules an authority would
apply.

`tests/fixtures/golden-charts.json` holds the structure for closing that gap,
and `tests/golden-charts.test.ts` asserts any fixture marked `verified`.
**Currently none are**, and the suite says so on every run rather than passing
silently. Adding one verified chart converts the whole rule layer from
"internally consistent" to "validated".

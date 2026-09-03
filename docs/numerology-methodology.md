# Numerology methodology

Status: accepted — 3 September 2026
Implementation: `src/lib/numerology/`

## System: Chaldean

This product uses the **Chaldean** system, chosen deliberately for an
India-facing audience where it is the system in common use. It is never mixed
with Pythagorean values.

The defining difference: Chaldean assigns letter values **1 to 8 only**. Nine is
treated as sacred and is not assigned to any letter. Pythagorean assigns 1 to 9.
Mixing the two produces name numbers that are wrong in both systems.

| Value | Letters |
| --- | --- |
| 1 | A I J Q Y |
| 2 | B K R |
| 3 | C G L S |
| 4 | D M T |
| 5 | E H N X |
| 6 | U V W |
| 7 | O Z |
| 8 | F P |

A test asserts that no letter is ever assigned 9 and that all 26 letters are
covered.

## Master numbers: preserved, with one documented exception

11, 22 and 33 are **preserved** during reduction in:

- Life Path
- Name Number
- Soul Urge
- Personality

They are **reduced** in:

- Birth Number (Mulank)

The exception is deliberate. Traditional Indian practice reads the Mulank as a
single digit 1–9, so someone born on the 29th has a Mulank of 2, not 11. This
behaviour is asserted by test rather than left ambiguous.

## Rules

### Life Path

Reduce day, month and year **separately**, then sum and reduce the total,
preserving master numbers at each step.

Worked example, 14 August 1992:

```
day   14   → 1+4 = 5
month  8   → 8
year 1992  → 1+9+9+2 = 21 → 2+1 = 3
total 5+8+3 = 16 → 1+6 = 7
Life Path = 7 (ruled by Ketu)
```

Reducing the components before summing is what allows a master number to survive;
a straight digit sum of the whole date would destroy it.

### Birth Number (Mulank)

The day of the month, reduced to a single digit. The 14th gives 5; the 29th gives
2.

### Name numbers

- **Name Number** — Chaldean sum of every letter, reduced with masters preserved.
- **Soul Urge** — Chaldean sum of the vowels only (A, E, I, O, U).
- **Personality** — Chaldean sum of the consonants only.

Names are normalised to A–Z: accents are stripped, case is ignored, and spaces,
digits and punctuation are dropped. A name with no scoreable letters returns
nothing rather than zero.

### Rulers

| Number | Ruler |
| --- | --- |
| 1 | Sun |
| 2 | Moon |
| 3 | Jupiter |
| 4 | Rahu |
| 5 | Mercury |
| 6 | Venus |
| 7 | Ketu |
| 8 | Saturn |
| 9 | Mars |

A master number takes the ruler of its reduced digit, with its master status
reported separately rather than hidden.

## Determinism

Every calculation is plain TypeScript arithmetic with no I/O and no model
involvement. The same input always produces the same output, and each number
carries the working that produced it so a reader can verify it by hand.

Invalid input is rejected rather than coerced: `2026-02-30` and `1992-13-01` both
raise a `NumerologyCalculationError`.

## Numerology Report activation

The paid Numerology Report remains **inactive**. This calculator produces the
core numbers, but the report requires interpretive content per number and per
combination that does not exist yet. The product will not be listed for sale
until it does.

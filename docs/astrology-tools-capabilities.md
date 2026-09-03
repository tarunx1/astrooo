# VedAstro capability audit for Phase 6 tools

Date: 3 September 2026
Method: live probes against `https://api.vedastro.org/api` (free tier, 5 req/min)

Every row below was verified by an actual request, not read from documentation.

## Critical format finding

`Time` parameters must be sent as an **object**, not a string:

```json
{ "StdTime": "06:35 14/08/1992 +05:30",
  "Location": { "Name": "Amritsar", "Longitude": 74.8723, "Latitude": 31.634 } }
```

Sending a string such as `"06:35 14/08/1992 +05:30 Amritsar,India"` returns
`Status: "Pass"` **with silently defaulted input** — the response came back for
`00:00 01/01/2000 +08:00` at `Location: Empty, lat 4.59, lon 101.0`. This is the
dangerous failure mode: a successful-looking response containing a Panchang for
the wrong century and the wrong hemisphere. The adapter therefore always sends
the object form via the existing `toVedAstroTime`, and the Panchang normalizer
asserts the echoed location and date match what was requested.

Parameter names also differ per calculator and are not guessable:

| Calculator | Required parameter(s) |
| --- | --- |
| `AllPlanetData`, `AllHouseData` | `Time` |
| `PanchangaTable` | `inputTime` |
| `MatchReport` | `maleBirthTime`, `femaleBirthTime` |

## Feature support

| Feature | Status | Provider method |
| --- | --- | --- |
| Ashtakoota aggregate score | **PARTIALLY SUPPORTED** | `MatchReport` → `KutaScore` |
| Ashtakoota per-koota sub-scores | **PARTIALLY SUPPORTED** | `MatchReport` → only 3 of 8 carry `Score` |
| Koota good/bad classification | SUPPORTED | `MatchReport` → `PredictionList[].Nature` |
| Manglik / Kuja Dosa comparison | SUPPORTED | `MatchReport` → `Kuja Dosa` prediction |
| Tithi, Paksha | SUPPORTED | `PanchangaTable` |
| Nakshatra (with pada) | SUPPORTED | `PanchangaTable`, `AllPlanetData` |
| Yoga, Karana, Vara | SUPPORTED | `PanchangaTable` |
| Lunar month | SUPPORTED | `PanchangaTable` |
| Sunrise, sunset | SUPPORTED | `PanchangaTable` |
| Hora lord, Disha Shool, Ishta Kaala | SUPPORTED | `PanchangaTable` |
| **Moonrise, moonset** | **NOT SUPPORTED** | `MoonRise` → *Calculator method not found* |
| **Rahu Kaal, Yamaganda, Gulika** | **NOT SUPPORTED** | `RahuKaalam` → *Calculator method not found* |
| **Abhijit Muhurat** | **NOT SUPPORTED** | no calculator found |
| Moon sign | SUPPORTED | `AllPlanetData` (already in cached Kundli) |
| Ascendant / Lagna | SUPPORTED | `AllHouseData` (already in cached Kundli) |
| Saturn transit position | SUPPORTED | `AllPlanetData` with `PlanetName: "Saturn"` at any instant |
| **Sade Sati endpoint** | **NOT SUPPORTED** | `SadeSati` → *Calculator method not found* |

Absent fields are omitted from the UI. None is filled with a placeholder or an
estimate.

## Ashtakoota: what we can and cannot show

`MatchReport` for a real pair returned `KutaScore: 20.0` and 31 predictions. Of
the eight classical kootas, **only three expose a numeric `Score`**:

| Koota | Score present | Example value |
| --- | --- | --- |
| Graha Maitram | yes | 3.0 |
| Guna Kuta | yes | 2.0 |
| Yoni Kuta | yes | 0.0 |
| Varna | no | `Nature: Bad` |
| Vasya Kuta | no | `Nature: Bad` |
| Dina Kuta (Tara) | no | `Nature: Good` |
| Rasi Kuta (Bhakoot) | no | `Nature: Bad` |
| Nadi Kuta | no | `Nature: Bad` |

The `Embeddings` array (`[3,2,0,0,3,0,0,0]`) has eight entries and looks like a
sub-score vector, but it sums to 8 while `KutaScore` is 20. Its ordering and
scale are undocumented and unverified, so **it is not used**.

Consequently the matching page shows the provider's aggregate `KutaScore` and,
per koota, a numeric score **only where the provider supplied one**. The other
five are shown with their favourable/unfavourable classification and an explicit
"score not provided by the calculation engine" note. No sub-score is invented,
and nothing is back-filled to make the eight add up to 36.

## Sade Sati

There is no Sade Sati calculator. It is implemented instead as a **documented
deterministic rule** over two provider-supplied values, the same pattern already
used for Manglik:

1. Natal Moon sign — from the existing cached Kundli calculation, no extra call.
2. Saturn's current sidereal sign — one `AllPlanetData` call for `Saturn`,
   cached per UTC day because Saturn changes sign roughly every 2.5 years.

Classification by Saturn's sign relative to the natal Moon sign:

| Saturn position from Moon | Result |
| --- | --- |
| 12th | Sade Sati — first (rising) phase |
| 1st | Sade Sati — second (peak) phase |
| 2nd | Sade Sati — third (setting) phase |
| 4th | Ardha Kantaka (small panoti) |
| 8th | Ashtama Shani |
| otherwise | not active |

The astronomy comes entirely from the provider. Only the classification is ours,
and it is stated on the page.

## Request budget

| Tool | Cold calls | Cached calls |
| --- | --- | --- |
| Kundli (existing) | 3 | 0 |
| Moon sign / Nakshatra / Lagna | 0 extra — read from the cached Kundli | 0 |
| Sade Sati | 1 (Saturn transit, shared per UTC day) | 0 |
| Panchang | 1 | 0 |
| Kundli matching | 1 | 0 |

The three birth calculators deliberately reuse one cached Kundli calculation
rather than issuing separate requests, which matters on a 5 req/min free tier.

## Numerology

Not a provider capability. Implemented as deterministic TypeScript in
`src/lib/numerology`, documented in `docs/numerology-methodology.md`.

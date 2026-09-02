# Astrology Provider Decision

Date: 2026-09-02

## Selected Provider

`VedAstroProvider`, backed by the hosted VedAstro REST API.

The application keeps the existing `AstrologyProvider` boundary. UI, persistence and chart components consume the internal `KundliResult` contract only; VedAstro response keys are decoded and normalized inside `src/lib/astrology/providers`.

## Verified API Details

- Base REST API: `https://api.vedastro.org/api`
- Cold Kundli request count: 3 external calls
  - `POST /Calculate/AllPlanetData`
  - `POST /Calculate/AllHouseData`
  - `POST /Calculate/DasaAtTime`
- Cache hit request count: 0 external calls
- Response envelope: `{ "Status": "Pass" | "Fail", "Payload": ... }`
- Failure shape: `Status: "Fail"` with string `Payload`; the app maps this to a typed provider error and never sends the raw API string to UI.
- Successful payload nesting varies. `AllPlanetData` and `AllHouseData` returned arrays in live checks; `DasaAtTime` returned nested `Payload.DasaAtTime`.
- Time format: `StdTime` string as `HH:MM DD/MM/YYYY +/-HH:MM`, not ISO 8601.
- Ayanamsa: app pins `LAHIRI`; VedAstro also documents `RAMAN`, `KRISHNAMURTI`, and `YUKTESHWAR`.
- Authentication: free tier works without a key at 5 requests/minute. Premium key can be sent as `x-api-key`, `APIKey`, or `Authorization: Bearer ...`.

## Calculation Config

The canonical app config is in `src/config/astrology.ts`:

- `ayanamsa: "LAHIRI"`
- `zodiac: "SIDEREAL"`
- `houseSystem: "VEDASTRO_DEFAULT"`
- `version: "ravish-kundli-v1.1"`

The deterministic cache hash includes birth date, normalized birth time, time accuracy, latitude, longitude, IANA timezone, ayanamsa, house system and calculation version. Any config/version change invalidates cached calculations.

## Timezone Handling

The VedAstro mapper converts internal birth details to VedAstro `StdTime` using the location's IANA timezone and the historical offset for that local wall-clock time. It does not hardcode India or `+05:30`.

Covered test zones:

- `Asia/Kolkata`
- `America/New_York`
- `Australia/Adelaide`

## Normalized Fields

The adapter normalizes:

- Nine planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu
- Sign
- Absolute longitude
- Degree in sign
- House
- Nakshatra and pada
- Retrograde flag
- Ascendant sign and degree
- Vimshottari Mahadasha and Antardasha

`KundliChart` continues to read normalized `KundliHouse` data only.

## Manglik And Yogas

VedAstro is used for the chart and dasha data. This adapter does not use a provider-specific single Manglik endpoint because one was not verified during implementation.

Manglik status is therefore deterministic and documented: Mars in houses 1, 4, 7, 8 or 12 is `Manglik`; otherwise `Non-Manglik`.

Yogas are returned as `[]` until deterministic production rules are defined.

## Runtime Configuration

```bash
ASTROLOGY_PROVIDER=vedastro
VEDASTRO_API_KEY=
VEDASTRO_API_BASE_URL=https://api.vedastro.org/api
VEDASTRO_TIMEOUT_MS=10000
VEDASTRO_RETRY_COUNT=1
```

`ASTROLOGY_PROVIDER=development` remains available for local UI work and tests. It is blocked in production and is never used as a fallback after a VedAstro failure.

## Error And Logging Policy

The server-only VedAstro client uses:

- `AbortController` timeout
- Conservative retry for transient failures
- Typed provider errors for validation, rate limit, timeout, configuration and unavailable states
- Safe logs containing provider, operation, latency, cache hit/miss and success/failure only

Logs must not include name, date of birth, birth time, coordinates or place details.

## Remaining Risks

- Free unauthenticated tier is limited to 5 requests/minute; production should use a paid key.
- VedAstro exposes many method-level payload shapes, so new endpoints must be added with tests before UI use.
- Yoga detection requires explicit deterministic rules before display.
- Manglik should switch to a verified provider endpoint if VedAstro publishes or documents a single status call suitable for this result contract.

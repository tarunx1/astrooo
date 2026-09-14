import { SIGNS } from "@/config/astrology";
import { ZODIAC_GLYPH_PATHS } from "@/lib/star-image/zodiac-shapes";

/** Decorative zodiac dial; positions are illustration coordinates. */
export function ZodiacDial() {
  return (
    <svg aria-hidden="true" viewBox="0 0 600 600" className="zodiac-dial absolute inset-0 size-full">
      <circle className="zodiac-dial-rim" cx="300" cy="300" r="278" />
      <circle className="zodiac-dial-hairline" cx="300" cy="300" r="258" />
      <circle className="zodiac-dial-hairline" cx="300" cy="300" r="174" />
      {Array.from({ length: 120 }, (_, index) => (
        <path
          key={index}
          className={index % 10 === 0 ? "zodiac-dial-major" : "zodiac-dial-tick"}
          d={`M300 26V${index % 10 === 0 ? 40 : index % 5 === 0 ? 35 : 31}`}
          transform={`rotate(${index * 3} 300 300)`}
        />
      ))}
      {SIGNS.map((sign, index) => (
        <g key={sign} transform={`rotate(${index * 30} 300 300)`}>
          <path className="zodiac-dial-divider" d="M345 132L366 53" />
          <path
            className="zodiac-dial-glyph"
            d={ZODIAC_GLYPH_PATHS[sign]}
            transform="translate(278 66) scale(.44)"
          />
          <text className="zodiac-dial-label" x="300" y="131" textAnchor="middle">{sign.toUpperCase()}</text>
          <path className="zodiac-dial-jewel" d="M300 144L303 149L300 154L297 149Z" />
        </g>
      ))}
      <circle className="zodiac-dial-inner" cx="300" cy="300" r="144" />
      <path className="zodiac-dial-hairline" d="M300 148V166M300 434V452M148 300H166M434 300H452" />
    </svg>
  );
}

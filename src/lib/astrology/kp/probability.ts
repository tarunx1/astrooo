export const KP_PROBABILITY_WEIGHTS = {
  dashaLord: 20,
  starLord: 30,
  subLord: 50,
} as const;

export type KpProbabilityLord = {
  houses: number[];
} | null;

export type KpProbabilityRow = {
  dashaLord: KpProbabilityLord;
  starLord: KpProbabilityLord;
  subLord: KpProbabilityLord;
};

export type KpRowProbability = {
  dashaLord: number;
  starLord: number;
  subLord: number;
  probability: number;
};

export function calculateKpRowProbability(
  row: KpProbabilityRow,
  selectedHouses: number[],
): KpRowProbability {
  const houses = normalizeHouses(selectedHouses);

  if (houses.length === 0) {
    return { dashaLord: 0, starLord: 0, subLord: 0, probability: 0 };
  }

  const dashaLord = contribution(row.dashaLord, houses, KP_PROBABILITY_WEIGHTS.dashaLord);
  const starLord = contribution(row.starLord, houses, KP_PROBABILITY_WEIGHTS.starLord);
  const subLord = contribution(row.subLord, houses, KP_PROBABILITY_WEIGHTS.subLord);

  return {
    dashaLord,
    starLord,
    subLord,
    probability: round(dashaLord + starLord + subLord),
  };
}

export function calculateKpOccurrenceProbability(
  rows: KpProbabilityRow[],
  selectedHouses: number[],
) {
  const rowProbabilities = rows.map((row) => calculateKpRowProbability(row, selectedHouses));
  const probability = rowProbabilities.length
    ? round(rowProbabilities.reduce((sum, row) => sum + row.probability, 0) / rowProbabilities.length)
    : 0;

  return {
    probability,
    rowWeight: rows.length ? round(100 / rows.length) : 0,
    rows: rowProbabilities,
  };
}

function contribution(lord: KpProbabilityLord, selectedHouses: number[], weight: number) {
  if (!lord) return 0;

  const lordHouses = new Set(normalizeHouses(lord.houses));
  const matchingHouses = selectedHouses.filter((house) => lordHouses.has(house)).length;

  // A lord earns its weight in proportion to how much of the selected combination it covers.
  return round((matchingHouses / selectedHouses.length) * weight);
}

function normalizeHouses(houses: number[]) {
  return [...new Set(houses.filter((house) => Number.isInteger(house) && house >= 1 && house <= 12))];
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

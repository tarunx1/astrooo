import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import {
  buildGeographySummary,
  type GeographyAggregateRow,
  type GeographySummary,
} from "@/lib/analytics/geography";

type RawGeographyRow = Omit<GeographyAggregateRow, "count"> & { count: number | bigint };

/**
 * One location per account, aggregated in PostgreSQL before it reaches Node.
 * A user's most recently updated owned birth profile is used as their coarse
 * profile location. Anonymous birth profiles are excluded.
 */
async function queryUserGeography(): Promise<GeographySummary> {
  const [rows, totalUsers] = await Promise.all([
    prisma.$queryRaw<RawGeographyRow[]>`
      WITH latest_profile AS (
        SELECT DISTINCT ON ("userId")
          "userId",
          NULLIF(BTRIM("city"), '') AS city,
          NULLIF(BTRIM("region"), '') AS region,
          NULLIF(BTRIM("country"), '') AS country,
          "latitude"::double precision AS latitude,
          "longitude"::double precision AS longitude
        FROM "BirthProfile"
        WHERE "userId" IS NOT NULL
        ORDER BY "userId", "updatedAt" DESC
      )
      SELECT
        MIN(city) AS city,
        MIN(region) AS region,
        COALESCE(MIN(country), 'Unknown') AS country,
        AVG(latitude)::double precision AS latitude,
        AVG(longitude)::double precision AS longitude,
        COUNT(*)::integer AS count
      FROM latest_profile
      GROUP BY
        LOWER(COALESCE(city, '')),
        LOWER(COALESCE(region, '')),
        LOWER(COALESCE(country, 'Unknown'))
      ORDER BY count DESC
      LIMIT 200
    `,
    prisma.user.count(),
  ]);

  return buildGeographySummary(
    rows.map((row) => ({ ...row, count: Number(row.count) })),
    totalUsers,
  );
}

/** Ten-minute cache: geography is analytical context, not live presence. */
export const getUserGeography = unstable_cache(queryUserGeography, ["user-geography-v1"], {
  revalidate: 600,
  tags: ["user-geography"],
});


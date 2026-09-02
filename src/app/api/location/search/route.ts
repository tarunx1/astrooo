import { NextResponse } from "next/server";
import { getLocationProvider } from "@/lib/location/provider";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const provider = getLocationProvider();
  const suggestions = await provider.search(query);

  return NextResponse.json({ suggestions });
}

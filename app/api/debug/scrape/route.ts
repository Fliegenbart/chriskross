import { NextRequest, NextResponse } from "next/server";
import { scrapeCompany } from "@/lib/scraper";

export const runtime = "nodejs";

// Dev-only helper for sanity-checking the scraper.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "?url= required" }, { status: 400 });
  const text = await scrapeCompany(url);
  return NextResponse.json({ url, length: text?.length ?? 0, preview: text?.slice(0, 1500) ?? null });
}

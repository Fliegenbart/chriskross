import { NextRequest, NextResponse } from "next/server";
import { Lead } from "@/lib/types";
import { guessWebsiteFromEmail, scrapeCompany } from "@/lib/scraper";
import { generateMail } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lead: Lead; variantSeed?: number };
    const lead = body.lead;
    if (!lead) return NextResponse.json({ error: "Missing lead" }, { status: 400 });

    const websiteUrl =
      lead.website?.trim() ||
      guessWebsiteFromEmail(lead.email) ||
      null;

    let scraped: string | null = null;
    if (websiteUrl) {
      scraped = await scrapeCompany(websiteUrl);
    }

    const result = await generateMail(lead, scraped, body.variantSeed ?? 1);

    const enriched: Lead = {
      ...lead,
      website: websiteUrl ?? lead.website,
      companySummary: result.companySummary,
      hook: result.hook,
      subject: result.subject,
      mailBody: result.mailBody,
      tokensUsed: (lead.tokensUsed ?? 0) + result.tokensUsed,
      status: "ready",
    };
    return NextResponse.json({ lead: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

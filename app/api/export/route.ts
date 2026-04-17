import { NextRequest, NextResponse } from "next/server";
import { Lead } from "@/lib/types";

export const runtime = "nodejs";

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes("\"") || v.includes("\n")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { leads: Lead[] };
  const leads = body.leads ?? [];
  const headers = [
    "first_name",
    "last_name",
    "email",
    "company",
    "website",
    "subject",
    "body",
    "company_summary",
    "hook",
    "status",
  ];
  const lines = [headers.join(",")];
  for (const l of leads) {
    lines.push(
      [
        l.firstName,
        l.lastName,
        l.email,
        l.company,
        l.website ?? "",
        l.subject ?? "",
        l.mailBody ?? "",
        l.companySummary ?? "",
        l.hook ?? "",
        l.status,
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(",")
    );
  }
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="krossmail-leads.csv"',
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { parseExcel } from "@/lib/excel";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei übergeben." }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const leads = parseExcel(buffer);
    return NextResponse.json({ leads, count: leads.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

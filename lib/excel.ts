import * as XLSX from "xlsx";
import { Lead } from "./types";

const FIRST_NAME_KEYS = ["vorname", "firstname", "first name", "first_name", "given name"];
const LAST_NAME_KEYS = ["nachname", "lastname", "last name", "last_name", "name", "family name", "surname"];
const FULL_NAME_KEYS = ["fullname", "full name", "full_name", "ansprechpartner", "contact"];
const EMAIL_KEYS = ["email", "e-mail", "mail", "e_mail"];
const COMPANY_KEYS = ["firma", "company", "unternehmen", "organization", "org"];
const WEBSITE_KEYS = ["website", "url", "webseite", "homepage", "domain"];

function normalize(key: string): string {
  return key.trim().toLowerCase();
}

function findField(row: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const [rawKey, value] of Object.entries(row)) {
    const k = normalize(rawKey);
    if (candidates.includes(k)) {
      const v = value == null ? "" : String(value).trim();
      if (v) return v;
    }
  }
  return undefined;
}

function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function guessGender(firstName: string): "m" | "f" | "x" {
  // Heuristic only: names ending in "a", "e", "ie", "ine" often female in DE; otherwise uncertain.
  const n = firstName.trim().toLowerCase();
  if (!n) return "x";
  const femaleEndings = ["a", "e", "ie", "ine", "ia"];
  const maleEndings = ["o", "er", "us", "an", "en", "in", "on", "lf", "ik", "as", "is"];
  const maleStrong = ["max", "michael", "thomas", "stefan", "martin", "peter", "andreas", "jan", "tim", "tom", "lukas", "paul", "david", "jonas", "felix", "moritz", "simon", "tobias", "dennis", "marcus", "markus", "philipp", "philip", "sebastian", "nikolas", "niklas", "lars", "björn", "bjoern", "nico", "oliver", "christian", "matthias", "florian", "patrick", "bernhard", "hans", "klaus", "johannes", "alexander", "ben", "leon", "noah", "elias", "henry", "luis"];
  const femaleStrong = ["anna", "julia", "laura", "sarah", "lisa", "marie", "sophie", "hannah", "katharina", "lea", "nina", "emma", "mia", "michelle", "vanessa", "jennifer", "jessica", "melanie", "stefanie", "katrin", "christine", "christina", "bettina", "claudia", "sabine", "petra", "birgit", "karin", "sandra", "monika", "ulrike", "susanne"];
  if (maleStrong.includes(n)) return "m";
  if (femaleStrong.includes(n)) return "f";
  for (const e of femaleEndings) if (n.endsWith(e)) return "f";
  for (const e of maleEndings) if (n.endsWith(e)) return "m";
  return "x";
}

export function parseExcel(buffer: ArrayBuffer): Lead[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const leads: Lead[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let firstName = findField(row, FIRST_NAME_KEYS) ?? "";
    let lastName = findField(row, LAST_NAME_KEYS) ?? "";
    const fullName = findField(row, FULL_NAME_KEYS);
    if ((!firstName || !lastName) && fullName) {
      const split = splitFullName(fullName);
      firstName = firstName || split.firstName;
      lastName = lastName || split.lastName;
    }
    // Fallback if "Name" column actually contained a full name
    if (firstName && !lastName && firstName.includes(" ")) {
      const split = splitFullName(firstName);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    const email = findField(row, EMAIL_KEYS) ?? "";
    const company = findField(row, COMPANY_KEYS) ?? "";
    const website = findField(row, WEBSITE_KEYS);

    if (!email && !company) continue;

    leads.push({
      id: `lead-${i}-${Date.now()}`,
      firstName,
      lastName,
      email,
      company,
      website,
      gender: guessGender(firstName),
      status: "pending",
    });
  }
  return leads;
}

import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const rows = [
  {
    Vorname: "Sarah",
    Nachname: "Hofmann",
    Email: "sarah.hofmann@ottogroup.com",
    Firma: "Otto Group",
    Website: "https://www.ottogroup.com/",
  },
  {
    Vorname: "Max",
    Nachname: "Köhler",
    Email: "max.koehler@statista.com",
    Firma: "Statista",
    Website: "https://www.statista.com/",
  },
  {
    Vorname: "Julia",
    Nachname: "Brandt",
    Email: "julia.brandt@hei-hamburg.de",
    Firma: "hei. Hamburger Existenzgründungsinitiative",
    Website: "https://www.hei-hamburg.de/",
  },
  {
    Vorname: "Tobias",
    Nachname: "Richter",
    Email: "tobias.richter@jungundmatt.de",
    Firma: "Jung von Matt",
    Website: "https://www.jvm.com/de/",
  },
  {
    Vorname: "Anna",
    Nachname: "Schubert",
    Email: "a.schubert@xing.com",
    Firma: "XING (New Work SE)",
    // No Website — should fallback to email domain
  },
];

const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Leads");
const out = "sample-leads.xlsx";
writeFileSync(out, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log(`wrote ${out} with ${rows.length} leads`);

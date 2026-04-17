"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Lead } from "@/lib/types";

type Stage = "idle" | "uploading" | "ready" | "enriching" | "done";
const CONCURRENCY = 3;

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stats = useMemo(() => {
    const total = leads.length;
    const ready = leads.filter((l) => l.status === "ready" || l.status === "approved" || l.status === "edited").length;
    const approved = leads.filter((l) => l.status === "approved").length;
    const enriching = leads.filter((l) => l.status === "enriching").length;
    const errors = leads.filter((l) => l.status === "error").length;
    const tokens = leads.reduce((acc, l) => acc + (l.tokensUsed ?? 0), 0);
    return { total, ready, approved, enriching, errors, tokens };
  }, [leads]);

  const handleFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    setStage("uploading");
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen");
      setLeads(data.leads);
      setStage("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStage("idle");
    }
  }, []);

  const enrichOne = useCallback(async (lead: Lead, signal: AbortSignal) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "enriching" } : l)));
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrichment failed");
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
    } catch (e) {
      if (signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, status: "error", errorMessage: msg } : l
        )
      );
    }
  }, []);

  const startEnrichment = useCallback(async () => {
    setStage("enriching");
    const controller = new AbortController();
    abortRef.current = controller;
    const queue = leads.filter((l) => l.status === "pending" || l.status === "error");
    let idx = 0;
    const worker = async () => {
      while (idx < queue.length && !controller.signal.aborted) {
        const current = queue[idx++];
        await enrichOne(current, controller.signal);
      }
    };
    const workers = Array.from({ length: CONCURRENCY }, worker);
    await Promise.all(workers);
    if (!controller.signal.aborted) setStage("done");
  }, [leads, enrichOne]);

  const cancelEnrichment = useCallback(() => {
    abortRef.current?.abort();
    setStage("ready");
  }, []);

  const regenerateOne = useCallback(async (lead: Lead) => {
    const newSeed = Math.floor(Math.random() * 1000) + 1;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "enriching" } : l)));
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, variantSeed: newSeed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regenerate failed");
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead : l)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, status: "error", errorMessage: msg } : l
        )
      );
    }
  }, []);

  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch, status: patch.status ?? "edited" } : l))
    );
  }, []);

  const approveLead = useCallback((id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "approved" } : l)));
  }, []);

  const downloadCsv = useCallback(async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "krossmail-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [leads]);

  const reset = useCallback(() => {
    setLeads([]);
    setFileName(null);
    setErrorMsg(null);
    setStage("idle");
    setOpenLeadId(null);
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-red-500 flex items-center justify-center font-black text-neutral-950">
            K
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Krossmail</h1>
            <p className="text-xs text-neutral-400">
              Kalte Pizza-Pitches. Aber warm rausgeschickt.
            </p>
          </div>
        </div>
        <div className="text-xs text-neutral-500 flex gap-4">
          <span>{stats.total} Leads</span>
          <span className="text-emerald-400">{stats.ready} fertig</span>
          <span className="text-amber-400">{stats.enriching} läuft</span>
          {stats.errors > 0 && <span className="text-rose-400">{stats.errors} Fehler</span>}
          {stats.tokens > 0 && <span>{stats.tokens.toLocaleString()} tokens</span>}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {errorMsg && (
          <div className="mb-4 rounded-md bg-rose-900/30 border border-rose-700 px-4 py-2 text-sm text-rose-200">
            {errorMsg}
          </div>
        )}

        {stage === "idle" || stage === "uploading" ? (
          <UploadStep onFile={handleFile} uploading={stage === "uploading"} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-neutral-400">
                {fileName} · {leads.length} Leads
              </div>
              <div className="flex gap-2">
                {stage === "ready" && (
                  <button
                    onClick={startEnrichment}
                    className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-neutral-950 text-sm font-semibold transition"
                  >
                    Mails generieren ▶
                  </button>
                )}
                {stage === "enriching" && (
                  <button
                    onClick={cancelEnrichment}
                    className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm"
                  >
                    Abbrechen
                  </button>
                )}
                {(stage === "done" || stats.ready > 0) && (
                  <button
                    onClick={downloadCsv}
                    className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-neutral-950 text-sm font-semibold"
                  >
                    CSV Export
                  </button>
                )}
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-100 text-sm"
                >
                  Reset
                </button>
              </div>
            </div>

            <LeadTable
              leads={leads}
              openLeadId={openLeadId}
              onOpen={setOpenLeadId}
              onRegenerate={regenerateOne}
              onUpdate={updateLead}
              onApprove={approveLead}
            />
          </>
        )}
      </div>
    </main>
  );
}

function UploadStep({ onFile, uploading }: { onFile: (f: File) => void; uploading: boolean }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-16 py-20 text-center transition
          ${dragOver ? "border-red-500 bg-red-500/5" : "border-neutral-700 hover:border-neutral-500"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        {uploading ? (
          <div className="text-neutral-300">Datei wird geparst…</div>
        ) : (
          <>
            <div className="text-xl font-semibold">Excel hier reinwerfen</div>
            <div className="text-sm text-neutral-400 mt-2">
              Spalten: Vorname, Nachname, Email, Firma · optional: Website
            </div>
          </>
        )}
      </div>
      <p className="mt-6 text-xs text-neutral-500 max-w-md text-center leading-relaxed">
        Wir parsen deine Datei, scrapen jede Firmen-Website (oder die Email-Domain), und Claude schreibt für jede:n Lead eine frische Mail im Chriss-Kross-Ton.
      </p>
    </div>
  );
}

function LeadTable({
  leads,
  openLeadId,
  onOpen,
  onRegenerate,
  onUpdate,
  onApprove,
}: {
  leads: Lead[];
  openLeadId: string | null;
  onOpen: (id: string | null) => void;
  onRegenerate: (l: Lead) => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onApprove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800 overflow-hidden">
      {leads.map((lead) => (
        <LeadRow
          key={lead.id}
          lead={lead}
          open={openLeadId === lead.id}
          onToggle={() => onOpen(openLeadId === lead.id ? null : lead.id)}
          onRegenerate={() => onRegenerate(lead)}
          onUpdate={(patch) => onUpdate(lead.id, patch)}
          onApprove={() => onApprove(lead.id)}
        />
      ))}
    </div>
  );
}

function LeadRow({
  lead,
  open,
  onToggle,
  onRegenerate,
  onUpdate,
  onApprove,
}: {
  lead: Lead;
  open: boolean;
  onToggle: () => void;
  onRegenerate: () => void;
  onUpdate: (patch: Partial<Lead>) => void;
  onApprove: () => void;
}) {
  const statusColor =
    lead.status === "approved"
      ? "bg-emerald-500"
      : lead.status === "ready"
      ? "bg-blue-400"
      : lead.status === "edited"
      ? "bg-violet-400"
      : lead.status === "enriching"
      ? "bg-amber-400 animate-pulse"
      : lead.status === "error"
      ? "bg-rose-500"
      : "bg-neutral-600";

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-12 gap-3 items-center px-4 py-3 text-left hover:bg-neutral-900 transition"
      >
        <div className="col-span-1 flex items-center">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        </div>
        <div className="col-span-3">
          <div className="font-medium text-sm">
            {lead.firstName} {lead.lastName}
          </div>
          <div className="text-xs text-neutral-500">{lead.email}</div>
        </div>
        <div className="col-span-3 text-sm">
          <div>{lead.company}</div>
          {lead.website && (
            <div className="text-xs text-neutral-500 truncate">{lead.website}</div>
          )}
        </div>
        <div className="col-span-5 text-xs text-neutral-400 truncate">
          {lead.status === "error"
            ? `⚠ ${lead.errorMessage ?? "Fehler"}`
            : lead.subject
            ? `Betreff: ${lead.subject}`
            : lead.status === "pending"
            ? "Noch nicht generiert"
            : lead.status === "enriching"
            ? "Claude schreibt gerade…"
            : ""}
        </div>
      </button>

      {open && (
        <div className="bg-neutral-900/50 border-t border-neutral-800 px-6 py-5 space-y-4">
          {lead.companySummary && (
            <div>
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Firma (laut Website)
              </div>
              <div className="text-sm text-neutral-300">{lead.companySummary}</div>
              {lead.hook && (
                <div className="text-xs text-amber-300 mt-1">Hook: {lead.hook}</div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wider text-neutral-500 block mb-1">
              Betreff
            </label>
            <input
              type="text"
              value={lead.subject ?? ""}
              onChange={(e) => onUpdate({ subject: e.target.value })}
              className="w-full rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-neutral-500 block mb-1">
              Mail
            </label>
            <textarea
              value={lead.mailBody ?? ""}
              onChange={(e) => onUpdate({ mailBody: e.target.value })}
              rows={10}
              className="w-full rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onRegenerate}
              disabled={lead.status === "enriching"}
              className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs disabled:opacity-50"
            >
              ↻ Neu generieren
            </button>
            <button
              onClick={onApprove}
              disabled={!lead.subject || !lead.mailBody}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-xs text-white disabled:opacity-50"
            >
              ✓ Freigeben
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

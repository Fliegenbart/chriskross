export type LeadStatus = "pending" | "enriching" | "ready" | "edited" | "approved" | "error";

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  website?: string;
  gender?: "m" | "f" | "x";
  status: LeadStatus;
  errorMessage?: string;

  // Populated after enrichment:
  companySummary?: string;
  hook?: string;
  subject?: string;
  mailBody?: string;

  // Bookkeeping:
  variantSeed?: number;
  tokensUsed?: number;
};

export type EnrichmentResult = {
  subject: string;
  mailBody: string;
  companySummary: string;
  hook: string;
  tokensUsed: number;
};

export const LEGAL_DOCUMENTS = {
  terms: {
    document: "terms",
    path: "/terms",
    version: "2026-09-03",
    effectiveDate: "2026-09-03",
  },
  privacy: {
    document: "privacy",
    path: "/privacy",
    version: "2026-09-03",
    effectiveDate: "2026-09-03",
  },
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS;

/** The same ordered versions rendered on the public pages and recorded at registration. */
export const CURRENT_LEGAL_DOCUMENTS = [LEGAL_DOCUMENTS.terms, LEGAL_DOCUMENTS.privacy] as const;

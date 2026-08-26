/**
 * Mirrors `MyGroupSummary` (server/services/groups.ts) — the wire shape
 * from `GET /api/groups` (api-contract.md § *Groups*). Declared here
 * rather than imported: `src/app/` never imports from `src/server/`
 * (frontend/CLAUDE.md § *The hard rule*), types included.
 */
export interface MyGroupSummary {
  id: string;
  title: string;
  archivedAt: string | null;
  memberCount: number;
  yourNet: { currency: string; net: string }[];
}

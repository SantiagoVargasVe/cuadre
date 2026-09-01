# Cuadre Agent Instructions

Read [CLAUDE.md](CLAUDE.md) as the canonical shared project context for every task. Do not duplicate or override its instructions here.

Load the scoped conventions for the work you touch:

- Frontend work in `src/app/` (except `src/app/api/`) and UI/client concerns in `src/lib/`: read [docs/frontend/CLAUDE.md](docs/frontend/CLAUDE.md).
- Backend and API work in `src/server/` and `src/app/api/`: read [docs/backend/CLAUDE.md](docs/backend/CLAUDE.md).
- For cross-cutting work, read both scoped documents as appropriate.

Task Context documents are mandatory: when a backlog task applies, read every document named in its `Context` section before starting. Preserve the task's `Out of scope`; do not add unrelated work.

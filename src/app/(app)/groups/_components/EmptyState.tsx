import { es } from "../../../../lib/i18n/es";

const t = es.groups.empty;

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium text-foreground">{t.title}</p>
      <p className="text-sm text-muted-foreground">{t.body}</p>
    </div>
  );
}

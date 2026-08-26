import Link from "next/link";
import { es } from "../../../../lib/i18n/es";
import { cn } from "../../../../lib/cn";
import { Money } from "../../../_ui/Money";
import type { MyGroupSummary } from "./types";

const t = es.groups;

function netClassName(net: bigint): string {
  if (net > 0n) return "text-credit";
  if (net < 0n) return "text-debit";
  return "text-settled";
}

/**
 * One net line per currency, never summed (frontend/CLAUDE.md § *Multi-
 * currency display*). The currency code is shown next to the amount
 * because `<Money>`'s narrowSymbol can render the same "$" for more than
 * one of this app's currencies — the code is what disambiguates a COP
 * line from a USD one, not just the figure.
 */
export function GroupCard({ group }: { group: MyGroupSummary }) {
  return (
    <Link
      href={`/g/${group.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground",
        "hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        group.archivedAt && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{group.title}</span>
        <span className="text-sm text-muted-foreground">{t.memberCount(group.memberCount)}</span>
      </div>
      <div className="flex flex-col gap-1 text-sm tabular-nums">
        {group.yourNet.length === 0 ? (
          <span className="text-settled">{t.settled}</span>
        ) : (
          group.yourNet.map((entry) => {
            const net = BigInt(entry.net);
            return (
              <span key={entry.currency} className={netClassName(net)}>
                {entry.currency} <Money value={{ amount: net, currency: entry.currency }} signed />
              </span>
            );
          })
        )}
      </div>
    </Link>
  );
}

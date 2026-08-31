import { es } from "../../../../../lib/i18n/es";
import { formatMoney } from "../../../../../lib/money/format";
import { Avatar } from "../../../../_ui/Avatar";
import type { BalanceMemberView } from "./balancesTypes";

const t = es.balances;

function netText(net: bigint, currency: string): { text: string; className: string } {
  const formatted = formatMoney({ amount: net < 0n ? -net : net, currency });
  if (net > 0n) return { text: t.netIsOwed(formatted), className: "text-credit" };
  if (net < 0n) return { text: t.netOwes(formatted), className: "text-debit" };
  return { text: t.netSettled, className: "text-settled" };
}

/**
 * Paid / share / net for one member (T066 acceptance criteria) — net is
 * always a word plus the absolute amount, never a bare signed number
 * (frontend/CLAUDE.md § *Balances and the simplify toggle*: "Ana te debe"
 * and "le debes a Ana" are different sentences). `role="group"` plus the
 * combined `aria-label` is what ties every figure back to whose row it's
 * in for assistive tech, since the visible layout only implies that.
 */
export function BalanceMemberRow({ member, displayName, currency }: { member: BalanceMemberView; displayName: string; currency: string }) {
  const paid = formatMoney({ amount: BigInt(member.paid), currency });
  const share = formatMoney({ amount: BigInt(member.owed), currency });
  const { text, className } = netText(BigInt(member.net), currency);

  return (
    <div
      role="group"
      aria-label={`${displayName}: ${t.paidLabel} ${paid}, ${t.shareLabel} ${share}, ${text}`}
      className="flex items-center justify-between gap-2 text-sm"
    >
      <span aria-hidden="true" className="flex items-center gap-2 font-medium text-foreground">
        <Avatar userId={member.userId} displayName={displayName} size={24} />
        {displayName}
      </span>
      <div aria-hidden="true" className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t.paidLabel} {paid} · {t.shareLabel} {share}
        </span>
        <span className={`tabular-nums ${className}`}>{text}</span>
      </div>
    </div>
  );
}

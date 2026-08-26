import { es } from "../../../../../lib/i18n/es";
import { formatCalendarDate } from "../../../../../lib/date/format";
import { TooltipContent, TooltipRoot, TooltipTrigger } from "../../../../_ui/Tooltip";
import { BalanceMemberRow } from "./BalanceMemberRow";
import { PaymentPlanRow } from "./PaymentPlanRow";
import type { CurrencyBalancesView } from "./balancesTypes";
import type { GroupMember } from "./types";

const t = es.balances;

function nameLookup(members: GroupMember[]): (userId: string) => string {
  const byId = new Map(members.map((m) => [m.userId, m.displayName]));
  return (userId: string) => byId.get(userId) ?? "?";
}

export interface CurrencyBalanceBlockProps {
  block: CurrencyBalancesView;
  members: GroupMember[];
  myUserId: string;
}

/**
 * One currency's whole picture — never summed with any other block
 * (frontend/CLAUDE.md § *Multi-currency display*: "never sum across them,
 * never show a combined total"), which is why this component, not its
 * caller, owns the heading that names which currency it is.
 */
export function CurrencyBalanceBlock({ block, members, myUserId }: CurrencyBalanceBlockProps) {
  const nameOf = nameLookup(members);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{block.currency}</h2>
        {block.pins && block.pins.length > 0 && (
          <TooltipRoot>
            <TooltipTrigger
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
              aria-label={t.convertedMarkerLabel}
            >
              {t.convertedMarkerLabel}
            </TooltipTrigger>
            <TooltipContent>
              {block.pins.map((pin) => (
                <p key={`${pin.fromCurrency}-${pin.toCurrency}`}>
                  {t.pinLine(pin.fromCurrency, pin.toCurrency, formatCalendarDate(pin.asOf), pin.source)}
                </p>
              ))}
            </TooltipContent>
          </TooltipRoot>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {block.members.map((member) => (
          <BalanceMemberRow key={member.userId} member={member} displayName={nameOf(member.userId)} currency={block.currency} />
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium text-muted-foreground">{t.planHeading}</h3>
        {block.plan.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.settledBlock}</p>
        ) : (
          block.plan.map((edge) => (
            <PaymentPlanRow key={`${edge.from}-${edge.to}`} edge={edge} currency={block.currency} myUserId={myUserId} nameOf={nameOf} />
          ))
        )}
      </div>
    </section>
  );
}

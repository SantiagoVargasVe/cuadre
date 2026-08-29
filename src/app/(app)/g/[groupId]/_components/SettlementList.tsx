"use client";

import { es } from "../../../../../lib/i18n/es";
import { SettlementRow } from "./SettlementRow";
import type { GroupMember } from "./types";
import type { useSettlements } from "./useSettlements";

const t = es.settlements;

export interface SettlementListProps {
  members: GroupMember[];
  myUserId: string;
  mutations: ReturnType<typeof useSettlements>;
}

/** The recorded-payments history. One flat list, newest first — the
 * endpoint already returns `settled_on DESC, id DESC` (services/settlements.ts). */
export function SettlementList({ members, myUserId, mutations }: SettlementListProps) {
  const items = mutations.list.data?.items ?? [];
  const byId = new Map(members.map((m) => [m.userId, m.displayName]));
  const nameOf = (userId: string) => byId.get(userId) ?? "?";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.historyHeading}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((settlement) => (
            <SettlementRow
              key={settlement.id}
              settlement={settlement}
              members={members}
              myUserId={myUserId}
              mutations={mutations}
              nameOf={nameOf}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

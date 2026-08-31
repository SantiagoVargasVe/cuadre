"use client";

import { es } from "../../../../../lib/i18n/es";
import { buildMemberLookup } from "./memberLookup";
import { SettlementRow } from "./SettlementRow";
import type { GroupMember } from "./types";
import type { useSettlements } from "./useSettlements";

const t = es.settlements;

export interface SettlementListProps {
  groupId: string;
  members: GroupMember[];
  myUserId: string;
  presentCurrencies: string[];
  mutations: ReturnType<typeof useSettlements>;
}

/** The recorded-payments history. One flat list, newest first — the
 * endpoint already returns `settled_on DESC, id DESC` (services/settlements.ts). */
export function SettlementList({ groupId, members, myUserId, presentCurrencies, mutations }: SettlementListProps) {
  const items = mutations.list.data?.items ?? [];
  const { nameOf, avatarOf } = buildMemberLookup(members);

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
              groupId={groupId}
              settlement={settlement}
              members={members}
              myUserId={myUserId}
              presentCurrencies={presentCurrencies}
              mutations={mutations}
              nameOf={nameOf}
              avatarOf={avatarOf}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

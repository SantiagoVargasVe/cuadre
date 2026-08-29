import { vi } from "vitest";
import type { SettlementListResult } from "./settlementTypes";
import type { useSettlements } from "./useSettlements";

type Settlements = ReturnType<typeof useSettlements>;

/**
 * A stub of `useSettlements` for component tests that don't exercise the
 * real query/mutation wiring (that's covered against a mocked `fetch` in
 * SettleUpDialog.test.tsx). Only the members the settle-up components
 * actually read are populated.
 */
export function mockSettlements(items: SettlementListResult["items"] = []): Settlements {
  return {
    list: { data: { items, nextCursor: null } },
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
  } as unknown as Settlements;
}

import { es } from "../../../../../../lib/i18n/es";
import type { GroupMember } from "../types";
import type { SplitEditorState } from "./types";

const t = es.splitEditor;

/** The collapsed line — "two lines of text that open editors when
 * tapped" (design-system.md § *Layout*). */
export function summaryText(state: SplitEditorState, members: GroupMember[]): string {
  switch (state.strategy) {
    case "equal":
      return state.selectedIds.length === members.length
        ? t.summaryEqual
        : t.summaryEqualSubset(state.selectedIds.length);
    case "shares":
      return t.summaryShares;
    case "percentage":
      return t.summaryPercentage;
    case "exact":
      return t.summaryExact;
    case "loan": {
      const name = members.find((m) => m.userId === state.loanBeneficiary)?.displayName ?? "?";
      return t.summaryLoan(name);
    }
  }
}

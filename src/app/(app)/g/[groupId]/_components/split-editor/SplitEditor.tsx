"use client";

import * as React from "react";
import { es } from "../../../../../../lib/i18n/es";
import type { SplitInput } from "../../../../../../lib/schemas/expenses";
import { RadioGroup, RadioItem } from "../../../../../_ui/RadioGroup";
import type { GroupMember } from "../types";
import { RemainderText } from "./RemainderText";
import { StrategyPanel } from "./StrategyPanel";
import { summaryText } from "./summaryText";
import type { StrategyName } from "./types";
import { useSplitEditorState } from "./useSplitEditorState";

const t = es.splitEditor;

export interface SplitEditorProps {
  members: GroupMember[];
  totalAmount: bigint;
  currency: string;
  seed: string;
  onChange: (split: SplitInput, valid: boolean) => void;
}

/** Collapsed by default — "two lines of text that open editors when
 * tapped" (design-system.md), same affordance as `PayerEditor`. The shell
 * owns the live total and the save gate (T065); each strategy component
 * owns only its own inputs. */
export function SplitEditor({ members, totalAmount, currency, seed, onChange }: SplitEditorProps) {
  const [open, setOpen] = React.useState(false);
  const memberIds = React.useMemo(() => members.map((m) => m.userId), [members]);
  const c = useSplitEditorState(memberIds, totalAmount, seed);

  const valid = c.preview !== null;
  React.useEffect(() => {
    onChange(c.splitInput, valid);
    // c.splitInput is a fresh object every render; stringify keeps this
    // effect from firing every keystroke it doesn't actually need to. It
    // still needs `valid` explicitly — the total can flip a strategy like
    // `equal` between valid and not (total <= 0) with no change to the
    // split's own shape at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(c.splitInput), valid]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-left text-sm text-foreground underline decoration-dotted underline-offset-2"
      >
        {summaryText(c.state, members)}
      </button>
      {open && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <RadioGroup<StrategyName>
            value={c.state.strategy}
            onValueChange={(value) => c.setStrategy(value)}
            className="flex-row flex-wrap gap-4"
          >
            {(Object.keys(t.strategies) as StrategyName[]).map((name) => (
              <RadioItem key={name} value={name} label={t.strategies[name]} />
            ))}
          </RadioGroup>
          <StrategyPanel members={members} controller={c} currency={currency} />
          <RemainderText preview={c.preview} error={c.error} currency={currency} />
        </div>
      )}
    </div>
  );
}

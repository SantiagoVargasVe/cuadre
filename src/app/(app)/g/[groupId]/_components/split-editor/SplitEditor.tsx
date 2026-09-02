"use client";

import * as React from "react";
import { es } from "../../../../../../lib/i18n/es";
import { RadioGroup, RadioItem } from "../../../../../_ui/RadioGroup";
import type { GroupMember } from "../types";
import { RemainderText } from "./RemainderText";
import { StrategyPanel } from "./StrategyPanel";
import { summaryText } from "./summaryText";
import type { StrategyName } from "./types";
import type { SplitEditorController } from "./useSplitEditorState";

const t = es.splitEditor;

export interface SplitEditorProps {
  members: GroupMember[];
  currency: string;
  controller: SplitEditorController;
}

/** Collapsed by default — "two lines of text that open editors when
 * tapped" (design-system.md), same affordance as `PayerEditor`. The shell
 * owns the live total and the save gate (T065); each strategy component
 * owns only its own inputs. */
export function SplitEditor({ members, currency, controller: c }: SplitEditorProps) {
  const [open, setOpen] = React.useState(false);

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

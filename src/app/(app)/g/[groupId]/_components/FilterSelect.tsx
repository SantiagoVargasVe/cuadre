"use client";

import {
  SelectContent,
  SelectItem,
  selectItems,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "../../../../_ui/Select";

/** The "no filter" option's value. A sentinel rather than `""` so the
 * closed trigger always has an item to draw a label from (T103). */
export const ANY_VALUE = "__any__";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * One labelled filter dropdown, same shape as RecipientSelect: `items`
 * feeds the closed trigger the option's *label*, which is what stops a
 * member filter from showing a raw UUID (T103). Pass `ANY_VALUE` as the
 * first option — selecting it clears the filter.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: FilterOption[];
  onChange: (value: string | undefined) => void;
}) {
  const items = selectItems(options, (option) => option.value, (option) => option.label);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <SelectRoot
        items={items}
        value={value ?? ANY_VALUE}
        onValueChange={(next) =>
          onChange(!next || next === ANY_VALUE ? undefined : String(next))
        }
      >
        <SelectTrigger aria-label={label} className="min-h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
}

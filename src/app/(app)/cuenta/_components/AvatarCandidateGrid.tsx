"use client";

import { es } from "../../../../lib/i18n/es";
import {
  AVATAR_PALETTE_NAMES,
  AVATAR_VARIANTS,
  type AvatarPaletteName,
  type AvatarVariant,
} from "../../../../lib/avatar";
import { Avatar } from "../../../_ui/Avatar";
import { Button } from "../../../_ui/Button";
import { cn } from "../../../../lib/cn";

const t = es.account.avatar;

export interface AvatarCandidateGridProps {
  userId: string;
  seed: string;
  palette: AvatarPaletteName;
  variant: AvatarVariant;
  onPickVariant: (v: AvatarVariant) => void;
  onPickPalette: (p: AvatarPaletteName) => void;
  onReroll: () => void;
}

/** All six variants rendered live with the real `<Avatar>` at a legible
 * pick size — pick one; the palette chips and the "otra" reroll change the
 * whole grid at once (T108). No free-text seed anywhere. */
export function AvatarCandidateGrid({
  userId,
  seed,
  palette,
  variant,
  onPickVariant,
  onPickPalette,
  onReroll,
}: AvatarCandidateGridProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {AVATAR_PALETTE_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={palette === name}
            onClick={() => onPickPalette(name)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              palette === name ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {t.palette[name]}
          </button>
        ))}
        <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={onReroll}>
          {t.reroll}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {AVATAR_VARIANTS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={variant === v}
            aria-label={t.variantLabel(v)}
            onClick={() => onPickVariant(v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-2",
              variant === v ? "border-primary ring-2 ring-ring" : "border-border hover:border-ring",
            )}
          >
            <Avatar userId={userId} avatar={{ variant: v, seed, palette }} size={32} />
            <span className="text-[0.65rem] text-muted-foreground">{t.variantName[v]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

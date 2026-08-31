"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { apiFetch } from "../../../../lib/api/client";
import {
  AVATAR_SEED_RE,
  DEFAULT_PALETTE,
  DEFAULT_VARIANT,
  type AvatarChoice,
} from "../../../../lib/avatar";
import { es } from "../../../../lib/i18n/es";
import { Avatar } from "../../../_ui/Avatar";
import { Button } from "../../../_ui/Button";
import { AvatarCandidateGrid } from "./AvatarCandidateGrid";

const t = es.account.avatar;
const newSeed = () => nanoid(12);

/** The whole avatar screen: current avatar large, a live grid to pick from,
 * a reroll, and save / cancel / use-the-default. Nothing is written until
 * "Guardar"; every candidate seed is app-generated (T108). */
export function AvatarEditor({ userId, current }: { userId: string; current: AvatarChoice | null }) {
  const queryClient = useQueryClient();
  // Starts as the stored seed or empty — never a fresh `nanoid` during SSR,
  // which would differ on the client and mismatch on hydration. The first
  // client render fills it in; until then `<Avatar>` shows the userId-seeded
  // default for an empty seed.
  const [seed, setSeed] = React.useState(current?.seed ?? "");
  const [variant, setVariant] = React.useState(current?.variant ?? DEFAULT_VARIANT);
  const [palette, setPalette] = React.useState(current?.palette ?? DEFAULT_PALETTE);

  React.useEffect(() => {
    setSeed((s) => (AVATAR_SEED_RE.test(s) ? s : newSeed()));
  }, []);

  const preview: AvatarChoice = { variant, seed, palette };
  const save = useMutation({
    mutationFn: (choice: AvatarChoice | null) =>
      apiFetch("/api/auth/avatar", { method: "PUT", body: choice }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>

      <div className="flex items-center gap-3">
        <Avatar userId={userId} avatar={preview} size={96} />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{t.previewSmall}</span>
          <Avatar userId={userId} avatar={preview} size={24} />
        </div>
      </div>

      <AvatarCandidateGrid
        userId={userId}
        seed={seed}
        palette={palette}
        variant={variant}
        onPickVariant={setVariant}
        onPickPalette={setPalette}
        onReroll={() => setSeed(newSeed())}
      />

      {save.isError && <p role="alert" className="text-sm text-destructive">{t.error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={save.isPending}
          onClick={() => {
            setSeed(newSeed());
            setVariant(DEFAULT_VARIANT);
            setPalette(DEFAULT_PALETTE);
            save.mutate(null);
          }}
        >
          {t.useDefault}
        </Button>
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate(preview)}>
          {save.isPending ? t.saving : t.save}
        </Button>
      </div>
    </section>
  );
}

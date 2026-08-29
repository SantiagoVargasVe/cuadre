"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import { TextField } from "../../../../_ui/TextField";

const t = es.settings.meta;

export interface GroupMetaFormProps {
  groupId: string;
  title: string;
  description: string;
  archivedAt: string | null;
}

/** Rename, description and archive — an **owner-only** section (the caller
 * renders it only for an owner, so the controls are absent, not disabled,
 * for everyone else — design-system.md § Tests). */
export function GroupMetaForm({ groupId, title, description, archivedAt }: GroupMetaFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ title, description });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["group", groupId] });

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/groups/${groupId}`, { method: "PATCH", body: form }),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: () => apiFetch(`/api/groups/${groupId}/archive`, { method: "POST", body: {} }),
    onSuccess: invalidate,
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <TextField
        label={t.titleLabel}
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="group-description" className="text-sm font-medium text-foreground">{t.descriptionLabel}</label>
        <textarea
          id="group-description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t.saving : t.save}
        </Button>
        {archivedAt ? (
          <span className="text-xs text-muted-foreground">{t.archived}</span>
        ) : (
          <DialogRoot>
            <DialogTrigger render={<Button type="button" variant="ghost">{t.archive}</Button>} />
            <DialogContent>
              <DialogTitle className="text-lg font-semibold text-foreground">{t.archiveTitle}</DialogTitle>
              <p className="mt-2 text-sm text-foreground">{t.archiveConfirm(title)}</p>
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose render={<Button variant="ghost" type="button" />}>{t.cancel}</DialogClose>
                <DialogClose
                  render={<Button variant="destructive" type="button" />}
                  onClick={() => archive.mutate()}
                >
                  {t.archive}
                </DialogClose>
              </div>
            </DialogContent>
          </DialogRoot>
        )}
      </div>
      {(save.isError || archive.isError) && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
    </section>
  );
}

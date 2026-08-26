"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../../lib/api/client";
import { es } from "../../../../lib/i18n/es";
import { KNOWN_CURRENCIES } from "../../../../lib/money/format";
import { createGroupSchema, type CreateGroupInput } from "../../../../lib/schemas/groups";
import { Button } from "../../../_ui/Button";
import { DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../_ui/Dialog";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "../../../_ui/Select";
import { TextField } from "../../../_ui/TextField";
import type { MyGroupSummary } from "./types";

const t = es.groups.createDialog;

export function CreateGroupDialog() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    mode: "onChange",
    defaultValues: { title: "", description: "", defaultCurrency: KNOWN_CURRENCIES[0] },
  });

  async function onSubmit(data: CreateGroupInput) {
    setFormError(null);
    try {
      const { group } = await apiFetch<{ group: MyGroupSummary }>("/api/groups", {
        method: "POST",
        body: data,
      });
      router.push(`/g/${group.id}`);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t.errors.generic);
    }
  }

  return (
    <DialogRoot>
      <DialogTrigger render={<Button>{es.groups.createButton}</Button>} />
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{t.title}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4" noValidate>
          <TextField label={t.titleLabel} error={errors.title?.message} {...register("title")} />
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              {t.descriptionLabel}
            </label>
            <textarea
              id="description"
              rows={3}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("description")}
            />
            <p className="text-sm text-muted-foreground">{t.descriptionHint}</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{t.currencyLabel}</span>
            <Controller
              name="defaultCurrency"
              control={control}
              render={({ field }) => (
                <SelectRoot value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label={t.currencyLabel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              )}
            />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" type="button" />}>{t.cancel}</DialogClose>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting ? t.submitting : t.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../../lib/api/client";
import { es } from "../../../../lib/i18n/es";
import {
  changePasswordFormSchema,
  type ChangePasswordFormInput,
} from "../../../../lib/schemas/auth";
import { Button } from "../../../_ui/Button";
import { TextField } from "../../../_ui/TextField";

const t = es.account.security.changePassword;

export function ChangePasswordForm() {
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: "onChange",
  });

  async function onSubmit(data: ChangePasswordFormInput) {
    setFormError(null);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: data.currentPassword, newPassword: data.newPassword },
      });
      reset();
      setStatus("done");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setFormError(t.errors[code as keyof typeof t.errors] ?? t.errors.generic);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h3 className="text-sm font-medium text-foreground">{t.heading}</h3>
      <TextField
        label={t.currentLabel}
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <TextField
        label={t.newLabel}
        type="password"
        autoComplete="new-password"
        hint={t.newHint}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <TextField
        label={t.confirmLabel}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {status === "done" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t.success}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSubmitting || !isValid}>
          {isSubmitting ? t.submitting : t.submit}
        </Button>
      </div>
    </form>
  );
}

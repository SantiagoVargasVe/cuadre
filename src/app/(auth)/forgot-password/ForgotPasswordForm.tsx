"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../lib/api/client";
import { es } from "../../../lib/i18n/es";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../../../lib/schemas/auth";
import { Button } from "../../_ui/Button";
import { TextField } from "../../_ui/TextField";

const t = es.auth.forgotPassword;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setFormError(null);
    try {
      // Always 202 — the response says nothing about whether the address
      // exists, so the UI can't either.
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: data });
      setSent(true);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setFormError(t.errors[code as keyof typeof t.errors] ?? t.errors.generic);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t.successTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.successBody}</p>
        <p className="text-sm text-muted-foreground">
          {t.verifiedNote}{" "}
          <Link href="/login" className="text-primary underline">
            {t.verifiedNoteLink}
          </Link>
        </p>
        <Link href="/login" className="text-sm text-primary underline">
          {t.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      <p className="text-sm text-muted-foreground">{t.description}</p>
      <TextField label={t.emailLabel} type="email" error={errors.email?.message} {...register("email")} />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting || !isValid}>
        {isSubmitting ? t.submitting : t.submit}
      </Button>
      <Link href="/login" className="text-sm text-primary underline">
        {t.backToLogin}
      </Link>
    </form>
  );
}

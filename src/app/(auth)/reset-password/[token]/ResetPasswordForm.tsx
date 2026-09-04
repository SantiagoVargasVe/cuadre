"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../../lib/api/client";
import { es } from "../../../../lib/i18n/es";
import {
  resetPasswordFormSchema,
  type ResetPasswordFormInput,
} from "../../../../lib/schemas/auth";
import { Button } from "../../../_ui/Button";
import { TextField } from "../../../_ui/TextField";

const t = es.auth.resetPassword;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [tokenDead, setTokenDead] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onChange",
  });

  async function onSubmit(data: ResetPasswordFormInput) {
    setFormError(null);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: { token, password: data.password },
      });
      setDone(true); // keeps submit disabled through the redirect
      router.push("/login?reset=1");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code === "INVALID_TOKEN") {
        setTokenDead(true);
        return;
      }
      setFormError(t.errors[code as keyof typeof t.errors] ?? t.errors.generic);
    }
  }

  if (tokenDead) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t.invalidTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.invalidBody}</p>
        <Link href="/forgot-password" className="text-sm text-primary underline">
          {t.invalidLink}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      <TextField
        label={t.passwordLabel}
        type="password"
        autoComplete="new-password"
        hint={t.passwordHint}
        error={errors.password?.message}
        {...register("password")}
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
      <Button type="submit" disabled={isSubmitting || done || !isValid}>
        {isSubmitting || done ? t.submitting : t.submit}
      </Button>
    </form>
  );
}

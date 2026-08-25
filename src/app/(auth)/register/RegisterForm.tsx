"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../lib/api/client";
import { es } from "../../../lib/i18n/es";
import { registerSchema, type RegisterInput } from "../../../lib/schemas/auth";
import { Button } from "../../_ui/Button";
import { TextField } from "../../_ui/TextField";

const t = es.auth.register;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: { inviteCode: searchParams.get("code") ?? "" },
  });

  async function onSubmit(data: RegisterInput) {
    setFormError(null);
    try {
      await apiFetch("/api/auth/register", { method: "POST", body: data });
      router.push("/groups");
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(t.errors.generic);
        return;
      }
      if (error.code === "EMAIL_ALREADY_REGISTERED") {
        setError("email", { message: t.errors.EMAIL_ALREADY_REGISTERED });
      } else if (error.code === "INVALID_INVITE_CODE") {
        setError("inviteCode", { message: t.errors.INVALID_INVITE_CODE });
      } else {
        setFormError(t.errors[error.code as keyof typeof t.errors] ?? t.errors.generic);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      <TextField
        label={t.emailLabel}
        type="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField label={t.displayNameLabel} error={errors.displayName?.message} {...register("displayName")} />
      <TextField
        label={t.passwordLabel}
        type="password"
        hint={t.passwordHint}
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        label={t.inviteCodeLabel}
        error={errors.inviteCode?.message}
        {...register("inviteCode")}
      />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting || !isValid}>
        {isSubmitting ? t.submitting : t.submit}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t.hasAccount}{" "}
        <a href="/login" className="text-primary underline">
          {t.loginLink}
        </a>
      </p>
    </form>
  );
}

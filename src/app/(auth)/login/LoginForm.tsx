"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../lib/api/client";
import { es } from "../../../lib/i18n/es";
import { loginSchema, type LoginInput } from "../../../lib/schemas/auth";
import { Button } from "../../_ui/Button";
import { TextField } from "../../_ui/TextField";

const t = es.auth.login;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onChange" });

  async function onSubmit(data: LoginInput) {
    setFormError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: data });
      router.push("/groups");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setFormError(t.errors[code as keyof typeof t.errors] ?? t.errors.generic);
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
      <TextField
        label={t.passwordLabel}
        type="password"
        error={errors.password?.message}
        {...register("password")}
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
        {t.noAccount}{" "}
        <a href="/register" className="text-primary underline">
          {t.registerLink}
        </a>
      </p>
    </form>
  );
}

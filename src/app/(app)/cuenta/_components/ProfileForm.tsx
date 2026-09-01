"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../../../lib/api/client";
import { es } from "../../../../lib/i18n/es";
import { updateProfileSchema, type UpdateProfileInput } from "../../../../lib/schemas/auth";
import { Button } from "../../../_ui/Button";
import { TextField } from "../../../_ui/TextField";

const t = es.account.profile;

/** The "Perfil" section of /cuenta: rename yourself (T109). Shares
 * `updateProfileSchema` with the API, so the client can't accept a name
 * the server will reject. Nothing stores a copy of this name — see
 * `updateProfile` in the auth service. */
export function ProfileForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    mode: "onChange",
    defaultValues: { displayName },
  });

  const save = useMutation({
    mutationFn: (data: UpdateProfileInput) =>
      apiFetch("/api/auth/profile", { method: "PATCH", body: data }),
    onSuccess: (_result, data) => {
      // Two readers, two invalidations: the header renders the name from
      // the ["me"] query, and every group screen renders it server-side.
      queryClient.invalidateQueries({ queryKey: ["me"] });
      reset(data);
      router.refresh();
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>

      <form onSubmit={handleSubmit((data) => save.mutate(data))} className="flex flex-col gap-3" noValidate>
        <TextField
          label={t.nameLabel}
          autoComplete="name"
          error={errors.displayName?.message}
          {...register("displayName")}
        />

        {save.isError && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
        {save.isSuccess && !isDirty && (
          <p role="status" className="text-sm text-muted-foreground">{t.saved}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!isValid || !isDirty || save.isPending}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </section>
  );
}

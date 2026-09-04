import Link from "next/link";
import { Controller, type Control } from "react-hook-form";
import { es } from "../../../lib/i18n/es";
import { LEGAL_DOCUMENTS } from "../../../lib/legal";
import type { RegisterInput } from "../../../lib/schemas/auth";
import { Checkbox } from "../../_ui/Checkbox";

const t = es.auth.register.legal;

export function LegalAcceptanceFields({ control }: { control: Control<RegisterInput> }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{t.legend}</legend>
      <AcceptanceField control={control} name="termsAccepted" href={LEGAL_DOCUMENTS.terms.path}
        label={t.termsLabel} linkLabel={t.termsLink} />
      <AcceptanceField control={control} name="privacyAccepted" href={LEGAL_DOCUMENTS.privacy.path}
        label={t.privacyLabel} linkLabel={t.privacyLink} />
    </fieldset>
  );
}

interface AcceptanceFieldProps {
  control: Control<RegisterInput>;
  name: "termsAccepted" | "privacyAccepted";
  href: string;
  label: string;
  linkLabel: string;
}

function AcceptanceField({ control, name, href, label, linkLabel }: AcceptanceFieldProps) {
  const labelId = `${name}-label`;
  const errorId = `${name}-error`;
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <div>
        <div className="flex items-start gap-2">
          <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)}
            onBlur={field.onBlur} aria-labelledby={labelId} aria-describedby={fieldState.error ? errorId : undefined}
            aria-invalid={Boolean(fieldState.error)} className="size-11 shrink-0" />
          <p id={labelId} className="pt-2.5 text-sm text-foreground">
            {label}{" "}
            <Link href={href} target="_blank" rel="noreferrer" className="text-primary underline">
              {linkLabel}<span className="sr-only"> {es.legal.common.newTab}</span>
            </Link>
          </p>
        </div>
        {fieldState.error && <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">{fieldState.error.message}</p>}
      </div>
    )} />
  );
}

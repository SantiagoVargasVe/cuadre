import Link from "next/link";
import { formatCalendarDate } from "../../../lib/date/format";
import { es } from "../../../lib/i18n/es";
import { LEGAL_DOCUMENTS, type LegalDocument as LegalDocumentKey } from "../../../lib/legal";

export function LegalDocument({ document }: { document: LegalDocumentKey }) {
  const copy = es.legal[document];
  const details = LEGAL_DOCUMENTS[document];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6">
      <article className="flex flex-col gap-8 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <h1 className="text-3xl font-semibold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{es.legal.common.version(details.version)}</span>
            <time dateTime={details.effectiveDate}>
              {es.legal.common.effectiveDate(formatCalendarDate(details.effectiveDate))}
            </time>
          </div>
          <p>{copy.intro}</p>
        </header>

        {copy.sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets.length > 0 && (
              <ul className="list-disc space-y-2 pl-6">
                {section.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}

        <Link href="/" className="min-h-11 self-start py-3 text-primary underline">
          {es.legal.common.backToApp}
        </Link>
      </article>
    </main>
  );
}

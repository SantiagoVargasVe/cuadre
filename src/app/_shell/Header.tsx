import Link from "next/link";
import { es } from "../../lib/i18n/es";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const t = es.nav;

/** The one header instance every authenticated screen renders. Group-specific
 * context (name, tabs) is a separate block below it — see GroupHeading and
 * GroupTabs — not part of this component, so this stays reusable for /groups
 * and any future top-level route. */
export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link href="/groups" className="text-lg font-semibold text-foreground">
          {t.appName}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

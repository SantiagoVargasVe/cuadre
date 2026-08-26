import Link from "next/link";
import { es } from "../../../../lib/i18n/es";
import { RegisterForm } from "../../register/RegisterForm";
import { JoinAccept } from "./JoinAccept";

const t = es.join;

export interface InviteLookup {
  valid: boolean;
  groupTitle?: string;
  inviterName?: string | null;
}

export interface JoinViewProps {
  code: string;
  invite: InviteLookup;
  isLoggedIn: boolean;
}

/**
 * `invite.valid` decides everything here. A valid code branches again on
 * whether the visitor already has a session — logged in gets a join
 * button (JoinAccept), logged out gets the registration form prefilled
 * with this code (RegisterForm's own ?code= reading doesn't apply to a
 * path segment, so it takes this as an explicit prop instead).
 */
export function JoinView({ code, invite, isLoggedIn }: JoinViewProps) {
  if (!invite.valid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{t.invalidTitle}</h1>
        <p className="text-muted-foreground">{t.invalidBody}</p>
        <Link href="/login" className="text-primary underline">
          {t.loginLink}
        </Link>
      </div>
    );
  }

  const inviterName = invite.inviterName ?? t.someone;
  const heading = invite.groupTitle
    ? t.invitedToGroup(inviterName, invite.groupTitle)
    : t.invitedGeneric(inviterName);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
      {isLoggedIn ? <JoinAccept code={code} /> : <RegisterForm defaultInviteCode={code} />}
    </div>
  );
}

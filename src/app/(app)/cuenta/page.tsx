import type { AvatarChoice } from "../../../lib/avatar";
import { apiFetchServer } from "../../../lib/api/server";
import { es } from "../../../lib/i18n/es";
import { AvatarEditor } from "./_components/AvatarEditor";
import { ProfileForm } from "./_components/ProfileForm";
import { SecuritySection } from "./_components/SecuritySection";

interface MeResponse {
  user: { id: string; displayName: string; avatar: AvatarChoice | null };
}

/**
 * Personal settings — properties of the *user*, not of any one group, so
 * they live on their own route rather than in a group's Ajustes (T108).
 * A stack of sections: Perfil, the avatar, and a Seguridad placeholder
 * whose flow needs a mail story the deployment doesn't have (T109).
 */
export default async function AccountPage() {
  const { user } = await apiFetchServer<MeResponse>("/api/auth/me");
  const t = es.account;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.subheading}</p>
      </div>
      <ProfileForm displayName={user.displayName} />
      <AvatarEditor userId={user.id} current={user.avatar} />
      <SecuritySection />
    </div>
  );
}

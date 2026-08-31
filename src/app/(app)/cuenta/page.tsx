import type { AvatarChoice } from "../../../lib/avatar";
import { apiFetchServer } from "../../../lib/api/server";
import { es } from "../../../lib/i18n/es";
import { AvatarEditor } from "./_components/AvatarEditor";

interface MeResponse {
  user: { id: string; displayName: string; avatar: AvatarChoice | null };
}

/**
 * Personal settings — a property of the *user*, not of any one group, so it
 * lives on its own route rather than in a group's Ajustes (T108). For now
 * it holds only the avatar editor; growing it (display name, password) is
 * its own follow-up task.
 */
export default async function AccountPage() {
  const { user } = await apiFetchServer<MeResponse>("/api/auth/me");
  const t = es.account;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h1 className="text-xl font-semibold text-foreground">{t.heading}</h1>
      <AvatarEditor userId={user.id} current={user.avatar} />
    </div>
  );
}

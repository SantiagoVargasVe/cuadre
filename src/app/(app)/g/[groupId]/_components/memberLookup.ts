import type { AvatarChoice } from "../../../../../lib/avatar";
import type { GroupMember } from "./types";

export interface MemberLookup {
  nameOf: (userId: string) => string;
  avatarOf: (userId: string) => AvatarChoice | null;
}

/** `userId` → display name / chosen avatar, from the group's member list —
 * for the rows that only carry ids (plan edges, settlement history) and the
 * balance rows (T107, T108). */
export function buildMemberLookup(members: GroupMember[]): MemberLookup {
  const byId = new Map(members.map((m) => [m.userId, m]));
  return {
    nameOf: (userId) => byId.get(userId)?.displayName ?? "?",
    avatarOf: (userId) => byId.get(userId)?.avatar ?? null,
  };
}

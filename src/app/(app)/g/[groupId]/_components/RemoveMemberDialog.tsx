"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";
import { DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import { Money } from "../../../../_ui/Money";
import type { MemberSummary, OutstandingBalance } from "./groupSettingsTypes";

const t = es.settings.members;

/** Owner-only. Confirms by naming the person. If removal is refused for a
 * non-zero balance, the `422`'s `details.balances` are shown per currency —
 * "No puedes salir debiendo" with the numbers (T068). */
export function RemoveMemberDialog({ groupId, member }: { groupId: string; member: MemberSummary }) {
  const queryClient = useQueryClient();
  const [outstanding, setOutstanding] = React.useState<OutstandingBalance[] | null>(null);
  const [open, setOpen] = React.useState(false);

  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/api/groups/${groupId}/members/${member.userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      setOpen(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "MEMBER_HAS_BALANCE") {
        setOutstanding((error.details?.balances as OutstandingBalance[]) ?? []);
      }
    },
  });

  return (
    <DialogRoot open={open} onOpenChange={(next) => { setOpen(next); if (!next) setOutstanding(null); }}>
      <DialogTrigger render={<Button variant="ghost" size="sm" type="button">{t.remove}</Button>} />
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{t.removeTitle}</DialogTitle>
        {outstanding ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t.cannotOwe}</p>
            <ul className="flex flex-col gap-1">
              {outstanding.map((b) => (
                <li key={b.currency} className="text-sm">
                  <Money value={{ amount: BigInt(b.net), currency: b.currency }} signed />
                </li>
              ))}
            </ul>
            <DialogClose render={<Button variant="ghost" type="button" className="self-end" />}>{t.close}</DialogClose>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-foreground">{t.removeConfirm(member.displayName)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose render={<Button variant="ghost" type="button" />}>{t.cancel}</DialogClose>
              <Button variant="destructive" type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>
                {remove.isPending ? t.removing : t.remove}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

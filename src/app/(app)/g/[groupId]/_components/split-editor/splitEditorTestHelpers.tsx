import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SplitEditor } from "./SplitEditor";
import type { GroupMember } from "../types";

export const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
  { userId: "caro", displayName: "Caro", role: "member" },
];

export async function renderOpenEditor(totalAmount = 10000000n) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <SplitEditor members={members} totalAmount={totalAmount} currency="COP" seed="test-seed" onChange={onChange} />,
  );
  await user.click(screen.getByText("Dividido: entre todos"));
  return { onChange, user };
}

export function lastCall(onChange: ReturnType<typeof vi.fn>) {
  return onChange.mock.calls.at(-1)!;
}

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { SplitEditor } from "./SplitEditor";
import { useSplitEditorState, type SplitEditorController } from "./useSplitEditorState";
import type { GroupMember } from "../types";

export const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
  { userId: "caro", displayName: "Caro", role: "member" },
];

export async function renderOpenEditor(totalAmount = 10000000n) {
  let controller: SplitEditorController | undefined;

  function TestSplitEditor() {
    const memberIds = React.useMemo(() => members.map((member) => member.userId), []);
    controller = useSplitEditorState(memberIds, totalAmount, "test-seed");
    return <SplitEditor members={members} currency="COP" controller={controller} />;
  }

  const user = userEvent.setup();
  render(<TestSplitEditor />);
  await user.click(screen.getByText("Dividido: entre todos"));
  return { controller: () => controller!, user };
}

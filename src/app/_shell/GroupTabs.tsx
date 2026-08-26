"use client";

import { usePathname, useRouter } from "next/navigation";
import { es } from "../../lib/i18n/es";
import { Tab, TabsIndicator, TabsList, TabsRoot } from "../_ui/Tabs";

const t = es.groupTabs;

type TabValue = "expenses" | "balances" | "settings";

const TABS: { value: TabValue; label: string; segment: string | null }[] = [
  { value: "expenses", label: t.expenses, segment: null },
  { value: "balances", label: t.balances, segment: "balances" },
  { value: "settings", label: t.settings, segment: "ajustes" },
];

function activeTab(pathname: string, groupId: string): TabValue {
  const rest = pathname.slice(`/g/${groupId}`.length).replace(/^\/+/, "");
  return TABS.find((tab) => tab.segment === (rest || null))?.value ?? "expenses";
}

/**
 * The tab is a real route, not client-only state (design-system.md § *Group
 * tabs*), so a refresh or the back button lands on the right panel for
 * free. Base UI's Tabs supplies the ARIA/keyboard behaviour; navigation
 * itself goes through next/navigation rather than Tabs' own panel switch.
 */
export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeTab(pathname, groupId);

  return (
    <TabsRoot
      value={active}
      onValueChange={(value) => {
        const tab = TABS.find((t) => t.value === value);
        if (!tab) return;
        router.push(tab.segment ? `/g/${groupId}/${tab.segment}` : `/g/${groupId}`);
      }}
    >
      <TabsList className="relative">
        {TABS.map((tab) => (
          <Tab key={tab.value} value={tab.value}>
            {tab.label}
          </Tab>
        ))}
        <TabsIndicator />
      </TabsList>
    </TabsRoot>
  );
}

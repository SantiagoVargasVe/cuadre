"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { es } from "../../lib/i18n/es";
import { Tab, TabsIndicator, TabsList, TabsRoot } from "../_ui/Tabs";

const t = es.groupTabs;

type TabValue = "expenses" | "balances" | "insights" | "settings";

const TABS: { value: TabValue; label: string; segment: string | null }[] = [
  { value: "expenses", label: t.expenses, segment: null },
  { value: "balances", label: t.balances, segment: "balances" },
  { value: "insights", label: t.insights, segment: "insights" },
  { value: "settings", label: t.settings, segment: "ajustes" },
];

const hrefFor = (groupId: string, segment: string | null) =>
  segment ? `/g/${groupId}/${segment}` : `/g/${groupId}`;

function activeTab(pathname: string, groupId: string): TabValue {
  const rest = pathname.slice(`/g/${groupId}`.length).replace(/^\/+/, "");
  return TABS.find((tab) => tab.segment === (rest || null))?.value ?? "expenses";
}

/**
 * The tab is a real route, not client-only state (design-system.md § *Group
 * tabs*), so a refresh or the back button lands on the right panel for
 * free. Base UI's Tabs supplies the ARIA/keyboard behaviour; navigation
 * goes through next/navigation.
 *
 * Every sibling tab is prefetched on mount (`router.prefetch`, T106) — the
 * old code navigated with a bare `router.push` and no `<Link>`, so Next
 * never warmed the sibling routes and every switch started cold.
 */
export function GroupTabs({ groupId }: { groupId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeTab(pathname, groupId);

  React.useEffect(() => {
    for (const tab of TABS) router.prefetch(hrefFor(groupId, tab.segment));
  }, [router, groupId]);

  return (
    <TabsRoot
      value={active}
      onValueChange={(value) => {
        const tab = TABS.find((t) => t.value === value);
        if (!tab) return;
        router.push(hrefFor(groupId, tab.segment));
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

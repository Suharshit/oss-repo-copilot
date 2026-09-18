"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "./tabs.module.css";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab list, e.g. "Repo sections". */
  label: string;
  /** Prefix for element ids; panels use `tabPanelId(idPrefix, tab)`. */
  idPrefix: string;
  className?: string;
}

export function tabId(idPrefix: string, tab: string): string {
  return `${idPrefix}-tab-${tab}`;
}

export function tabPanelId(idPrefix: string, tab: string): string {
  return `${idPrefix}-panel-${tab}`;
}

/**
 * A WAI-ARIA tab list. Arrow keys, Home and End move between tabs and select
 * as they go; the caller renders the panels, labelled with `tabPanelId`.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
  className,
}: TabsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex((tab) => tab.id === active);
    const last = tabs.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];

    const tab = next === undefined ? undefined : tabs[next];
    if (next === undefined || !tab) return;
    event.preventDefault();
    onChange(tab.id);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={[styles.list, className].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            // Only the selected tab is in the tab order; arrows reach the rest.
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

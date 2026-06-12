"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { RosterEntry } from "@/lib/types";
import {
  SKIP_VALUE,
  type AssignmentValue,
} from "@/components/teacher/grade-wizard/use-stack-grade";

type RosterPickerProps = {
  roster: RosterEntry[];
  value: AssignmentValue;
  onChange: (value: AssignmentValue) => void;
  disabled?: boolean;
  id?: string;
};

type Option = {
  value: AssignmentValue;
  label: string;
  sublabel?: string;
  searchKey: string;
  isSkip?: boolean;
};

const SKIP_OPTION: Option = {
  value: SKIP_VALUE,
  label: "Skip this page",
  searchKey: "skip this page",
  isSkip: true,
};

function emailLocalPart(email: string | null): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function baseDisplayName(entry: RosterEntry): string {
  if (entry.full_name && entry.full_name.trim()) return entry.full_name.trim();
  if (entry.email) return entry.email;
  return entry.user_id.slice(0, 8);
}

function buildRosterOptions(roster: RosterEntry[]): Option[] {
  // Count duplicate full_names so we can disambiguate with email-local-part.
  const nameCounts = new Map<string, number>();
  for (const entry of roster) {
    const name = entry.full_name?.trim();
    if (!name) continue;
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return roster.map((entry) => {
    const base = baseDisplayName(entry);
    const name = entry.full_name?.trim();
    const isDuplicate = name ? (nameCounts.get(name) ?? 0) > 1 : false;
    const local = emailLocalPart(entry.email);

    let label = base;
    if (isDuplicate && local) {
      label = `${base} (${local})`;
    }

    const sublabel =
      entry.email && entry.full_name && entry.full_name.trim() ? entry.email : undefined;

    const searchKey = `${entry.full_name ?? ""} ${entry.email ?? ""}`.toLowerCase();

    return {
      value: entry.user_id as AssignmentValue,
      label,
      sublabel,
      searchKey,
    };
  });
}

export default function RosterPicker({
  roster,
  value,
  onChange,
  disabled = false,
  id,
}: RosterPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;
  const searchInputId = `${id ?? reactId}-search`;

  const rosterOptions = useMemo(() => buildRosterOptions(roster), [roster]);

  const allOptions = useMemo<Option[]>(
    () => [SKIP_OPTION, ...rosterOptions],
    [rosterOptions],
  );

  const filteredOptions = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    // Skip option always visible regardless of query so teachers can always move past.
    return allOptions.filter((opt) => opt.isSkip || opt.searchKey.includes(q));
  }, [allOptions, query]);

  const selectedOption = useMemo<Option | null>(() => {
    if (!value) return null;
    return allOptions.find((opt) => opt.value === value) ?? null;
  }, [allOptions, value]);

  const triggerLabel = selectedOption?.label ?? "Select student…";
  const isPlaceholder = !selectedOption;

  // Clamp the highlight to the current filtered list during render to avoid a
  // cascading setState in an effect.
  const safeHighlightIndex =
    filteredOptions.length === 0
      ? 0
      : Math.min(Math.max(highlightIndex, 0), filteredOptions.length - 1);

  const closePanel = useCallback((opts: { restoreFocus?: boolean } = {}) => {
    setOpen(false);
    setQuery("");
    setHighlightIndex(0);
    if (opts.restoreFocus !== false) {
      // Defer to allow panel to unmount before refocusing.
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setHighlightIndex(0);
  }, [disabled]);

  // Click-outside / focus-leave handling: single mousedown listener while open.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      // Click outside — close without selecting and don't steal focus.
      setOpen(false);
      setQuery("");
      setHighlightIndex(0);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // When opening, focus the search input.
  useEffect(() => {
    if (open) {
      // Use rAF so the input is mounted before focusing.
      const raf = requestAnimationFrame(() => {
        searchRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  // Scroll the highlighted item into view.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLLIElement>(
      `[data-option-index="${safeHighlightIndex}"]`,
    );
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [safeHighlightIndex, open]);

  function commitSelection(option: Option) {
    onChange(option.value);
    closePanel({ restoreFocus: true });
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPanel();
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (filteredOptions.length === 0) return;
        setHighlightIndex((safeHighlightIndex + 1) % filteredOptions.length);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (filteredOptions.length === 0) return;
        setHighlightIndex(
          (safeHighlightIndex - 1 + filteredOptions.length) % filteredOptions.length,
        );
        return;
      }
      case "Home": {
        event.preventDefault();
        setHighlightIndex(0);
        return;
      }
      case "End": {
        event.preventDefault();
        if (filteredOptions.length > 0) setHighlightIndex(filteredOptions.length - 1);
        return;
      }
      case "Enter": {
        event.preventDefault();
        const option = filteredOptions[safeHighlightIndex];
        if (option) commitSelection(option);
        return;
      }
      case "Escape": {
        event.preventDefault();
        closePanel({ restoreFocus: true });
        return;
      }
      case "Tab": {
        // Tab leaves the picker without selecting.
        closePanel({ restoreFocus: false });
        return;
      }
      default:
        return;
    }
  }

  const triggerClass = [
    "w-full flex items-center justify-between gap-2 rounded-lg border bg-paper px-3 py-2 text-left text-sm outline-none transition-colors duration-150",
    disabled
      ? "cursor-not-allowed opacity-60 border-line-soft text-ink-faint"
      : "cursor-pointer border-line text-ink hover:border-ink-faint focus:border-pen/50 focus:ring-2 focus:ring-pen-wash",
    isPlaceholder && !disabled ? "text-ink-faint" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showEmptyRosterMessage = roster.length === 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (open) closePanel({ restoreFocus: false });
          else openPanel();
        }}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClass}
      >
        <span className="truncate">{triggerLabel}</span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 flex-shrink-0 text-ink-faint transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-line-soft bg-paper shadow-lg"
        >
          <div className="border-b border-line-soft p-2">
            <label htmlFor={searchInputId} className="sr-only">
              Search students
            </label>
            <input
              ref={searchRef}
              id={searchInputId}
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search students…"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                filteredOptions[safeHighlightIndex]
                  ? `${listboxId}-opt-${safeHighlightIndex}`
                  : undefined
              }
              className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink placeholder-ink-faint outline-none transition-colors duration-150 focus:border-pen/50 focus:ring-2 focus:ring-pen-wash"
            />
          </div>

          {showEmptyRosterMessage ? (
            <div className="border-b border-line-soft px-3 py-2 text-xs text-ink-soft">
              This class has no students;{" "}
              <Link
                href="/t"
                className="font-medium text-pen underline hover:text-pen-deep"
                onClick={() => closePanel({ restoreFocus: false })}
              >
                invite someone first
              </Link>
              .
            </div>
          ) : null}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Students"
            className="max-h-[20rem] overflow-y-auto py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-xs italic text-ink-faint">
                No matches.
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isHighlighted = index === safeHighlightIndex;
                const isSelected = option.value === value;
                return (
                  <li
                    key={`${option.isSkip ? "skip" : option.value}`}
                    id={`${listboxId}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-option-index={index}
                    onMouseDown={(e) => {
                      // Prevent the input from losing focus before click fires.
                      e.preventDefault();
                    }}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => commitSelection(option)}
                    className={[
                      "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors duration-100",
                      isHighlighted ? "bg-cream" : "bg-paper",
                      option.isSkip
                        ? "border-b border-line-soft font-medium text-ink-soft"
                        : "text-ink",
                    ].join(" ")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{option.label}</div>
                      {option.sublabel ? (
                        <div className="truncate text-xs text-ink-faint">
                          {option.sublabel}
                        </div>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 flex-shrink-0 text-pen"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.42 0L3.296 9.12a1 1 0 011.42-1.42l3.58 3.58 6.49-6.49a1 1 0 011.418 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

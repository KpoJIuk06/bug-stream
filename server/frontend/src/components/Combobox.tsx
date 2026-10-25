import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useProject, useProjects, useUsers } from "../api/hooks";
import type { ProjectSummary, User } from "../api/types";
import { t } from "../i18n";
import { Avatar, cx, Spinner } from "./ui";

export interface ComboOption {
  value: string;
  label: string;
  /** Extra text that is searched too (key, e-mail, Jira ID ...). */
  hint?: string;
  icon?: ReactNode;
}

/**
 * A select with a search field. Options can be filtered locally or loaded by the caller
 * (onQuery is called with the debounced text).
 */
export function Combobox({
  value,
  onChange,
  options,
  selectedLabel,
  placeholder,
  emptyLabel,
  allowClear = true,
  onQuery,
  loading,
  className,
  disabled,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: ComboOption[];
  /** Label of the current value when it is not among the loaded options. */
  selectedLabel?: string;
  placeholder?: string;
  /** Text of the "no value" choice ("All projects"). */
  emptyLabel?: string;
  allowClear?: boolean;
  onQuery?: (q: string) => void;
  loading?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!onQuery) return;
    const h = setTimeout(() => onQuery(q.trim()), 200);
    return () => clearTimeout(h);
  }, [q, onQuery]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    if (onQuery) return options;
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s));
  }, [options, q, onQuery]);

  const items: (ComboOption | null)[] = allowClear && emptyLabel ? [null, ...filtered] : filtered;
  const current = options.find((o) => o.value === value);
  const shown = current?.label ?? (value ? selectedLabel ?? value : emptyLabel ?? placeholder ?? "");

  const choose = (o: ComboOption | null) => {
    onChange(o?.value);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={boxRef} className={cx("relative", className ?? "w-full")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setActive(0);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cx(
          "flex h-9 w-full items-center gap-2 rounded-control border border-line bg-surface px-3 text-left hover:border-faint focus:border-primary focus:outline-none disabled:bg-fog",
          !value && "text-muted",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.icon}
        <span className="min-w-0 flex-1 truncate">{shown}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" className="shrink-0 text-faint" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 min-w-[240px] overflow-hidden rounded-control border border-line bg-surface shadow-[0_12px_32px_-12px_rgba(24,32,44,0.3)]">
          <div className="border-b border-line-soft p-1.5">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (items[active] !== undefined) choose(items[active]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={placeholder ?? t("Search…")}
              className="h-8 w-full rounded-[6px] border border-line px-2.5 text-[13px] focus:border-primary focus:outline-none"
              role="combobox"
              aria-controls={listId}
              aria-expanded
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {items.map((o, i) => (
              <li
                key={o?.value ?? "__none"}
                role="option"
                aria-selected={(o?.value ?? undefined) === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                className={cx(
                  "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px]",
                  i === active && "bg-fog",
                  (o?.value ?? undefined) === value && "font-medium text-primary",
                )}
              >
                {o ? (
                  <>
                    {o.icon}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 font-mono text-[11.5px] text-faint">{o.hint}</span>}
                  </>
                ) : (
                  <span className="text-muted">{emptyLabel}</span>
                )}
              </li>
            ))}
            {loading && (
              <li className="flex justify-center py-2">
                <Spinner />
              </li>
            )}
            {!loading && filtered.length === 0 && <li className="px-3 py-2 text-[13px] text-faint">{t("Nothing found")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

const projectOption = (p: ProjectSummary): ComboOption => ({
  value: p.id,
  label: `${p.key} — ${p.name}`,
  hint: p.jiraProjectId ? `Jira ${p.jiraProjectId}` : undefined,
});

/** Project picker with search by name, key or Jira ID. */
export function ProjectPicker({
  value,
  onChange,
  emptyLabel = t("All projects"),
  allowClear = true,
  className,
  includeArchived = false,
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  emptyLabel?: string;
  allowClear?: boolean;
  className?: string;
  includeArchived?: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useProjects(q, includeArchived);
  const selected = useProject(value && !list.data?.some((p) => p.id === value) ? value : undefined);
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={(list.data ?? []).map(projectOption)}
      selectedLabel={selected.data ? `${selected.data.project.key} — ${selected.data.project.name}` : undefined}
      emptyLabel={emptyLabel}
      allowClear={allowClear}
      onQuery={setQ}
      loading={list.isFetching}
      placeholder={t("Name, key or Jira ID")}
      className={className}
    />
  );
}

const userOption = (u: User): ComboOption => ({
  value: u.id,
  label: u.fullName,
  hint: u.email,
  icon: <Avatar name={u.fullName} size={18} />,
});

/** User picker with search by name, e-mail or login. */
export function UserPicker({
  value,
  onChange,
  emptyLabel,
  extra,
  className,
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  emptyLabel: string;
  /** Options shown first, e.g. "Me". */
  extra?: ComboOption[];
  className?: string;
}) {
  const [q, setQ] = useState("");
  const list = useUsers(q);
  const options = [...(extra ?? []), ...(list.data ?? []).filter((u) => !extra?.some((x) => x.value === u.id)).map(userOption)];
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      emptyLabel={emptyLabel}
      onQuery={setQ}
      loading={list.isFetching}
      placeholder={t("Name or e-mail")}
      className={className}
    />
  );
}

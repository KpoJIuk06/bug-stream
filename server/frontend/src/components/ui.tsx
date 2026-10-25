import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { initials } from "../lib/format";
import { SEVERITY_LABEL, STATUS_LABEL } from "../lib/labels";
import { t } from "../i18n";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ----------------------------- buttons -----------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark disabled:bg-primary/50",
  secondary: "bg-surface text-ink border border-line hover:border-faint disabled:text-faint",
  ghost: "text-muted hover:text-ink hover:bg-line-soft disabled:text-faint",
  danger: "bg-surface text-ev-error border border-line hover:border-ev-error disabled:text-faint",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
>(function Button({ variant = "secondary", size = "md", className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-9 px-3.5",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
});

// ----------------------------- inputs -----------------------------

const fieldBase =
  "rounded-control border border-line bg-surface px-3 text-ink placeholder:text-faint hover:border-faint focus:border-primary focus:outline-none disabled:bg-fog";

/** Full width by default unless className sets its own (w-*, flex-1, min-w-*). */
const widthOf = (className?: string) => (/(^|\s)(w-|flex-1|min-w-)/.test(className ?? "") ? undefined : "w-full");

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(fieldBase, "h-9", widthOf(className), className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(fieldBase, "py-2 leading-relaxed", widthOf(className), className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, "h-9 pr-8 appearance-none bg-no-repeat select-chevron", widthOf(className), className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[13px] text-ev-error">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

// ----------------------------- badges -----------------------------

const statusStyle: Record<string, string> = {
  NEW: "bg-ev-network-soft text-ev-network",
  IN_PROGRESS: "bg-ev-warn-soft text-ev-warn",
  RESOLVED: "bg-ev-nav-soft text-ev-nav",
  CLOSED: "bg-line-soft text-muted",
  REJECTED: "bg-line-soft text-faint line-through decoration-1",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium", statusStyle[status] ?? "bg-line-soft text-muted")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const severityBars: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

/** Severity: four bars like a signal indicator — readable without color. */
export function SeverityMark({ severity, withLabel = false }: { severity: string | null | undefined; withLabel?: boolean }) {
  if (!severity) return withLabel ? <span className="text-faint">—</span> : null;
  const n = severityBars[severity] ?? 0;
  const color = n >= 4 ? "bg-ev-error" : n === 3 ? "bg-ev-warn" : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1.5" title={SEVERITY_LABEL[severity]}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cx("w-[3px] rounded-sm", i <= n ? color : "bg-line")} style={{ height: 4 + i * 2.5 }} />
        ))}
      </span>
      {withLabel && <span>{SEVERITY_LABEL[severity] ?? severity}</span>}
    </span>
  );
}

export function Tag({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-line bg-surface px-2 text-[12px] text-muted">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 px-1 text-faint hover:text-ev-error" aria-label={t("Remove")}>
          ×
        </button>
      )}
    </span>
  );
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  // color from the name — one person always gets the same color
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 38% 42%)` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

// ----------------------------- states -----------------------------

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block size-4 animate-spin rounded-full border-2 border-line border-t-primary", className)}
      role="status"
      aria-label={t("Loading")}
    />
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="size-6" />
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-control border border-ev-error/30 bg-ev-error-soft px-3 py-2 text-[13px] text-ev-error">{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-muted">{children}</div>}
    </div>
  );
}

// ----------------------------- modal -----------------------------

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 480,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto rounded-panel border border-line bg-surface p-0 text-ink shadow-[0_20px_60px_-15px_rgba(24,32,44,0.35)] backdrop:bg-ink/30"
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button onClick={onClose} className="-mr-1 -mt-1 rounded p-1 text-faint hover:text-ink" aria-label={t("Close")}>
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ----------------------------- page header & cards -----------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <div className="mt-0.5 text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-panel border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5">
          {title && <h2 className="mr-auto text-[14px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-line",
      )}
    >
      <span className={cx("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

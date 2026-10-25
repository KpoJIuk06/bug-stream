import { t } from "../i18n";
import { formatNumber } from "../lib/format";
import { Button, cx, Select } from "./ui";

export const PAGE_SIZES = [25, 50, 100];

/** Numbered pages + page size + "21–40 of 135". page is zero-based. */
export function Pagination({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
  onSize?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total === 0) return null;
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);

  // 1 … 4 5 [6] 7 8 … 20
  const nums: (number | "…")[] = [];
  const add = (n: number) => nums[nums.length - 1] !== n && nums.push(n);
  for (let i = 0; i < pages; i++) {
    if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 2) add(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[13px] text-muted">
        {t("{from}–{to} of {total}", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </span>
      {onSize && (
        <label className="flex items-center gap-2 text-[13px] text-muted">
          {t("Per page")}
          <Select className="h-8 w-20" value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
      )}
      {pages > 1 && (
        <nav className="ml-auto flex items-center gap-1" aria-label={t("Pages")}>
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={t("Previous page")}>
            ‹
          </Button>
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`gap${i}`} className="px-1 text-faint">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={cx(
                  "h-7 min-w-7 rounded-control px-2 text-[13px]",
                  n === page ? "bg-primary font-medium text-white" : "text-muted hover:bg-line-soft hover:text-ink",
                )}
              >
                {n + 1}
              </button>
            ),
          )}
          <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={t("Next page")}>
            ›
          </Button>
        </nav>
      )}
    </div>
  );
}

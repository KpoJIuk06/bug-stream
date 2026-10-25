import { useEnvironments } from "../api/hooks";
import { t } from "../i18n";
import { cx } from "./ui";

/** Environment badge in the color chosen in the admin panel. */
export function EnvBadge({ env, size = "md" }: { env: string | null | undefined; size?: "sm" | "md" }) {
  const list = useEnvironments(true);
  if (!env) return null;
  const e = list.data?.find((x) => x.code === env);
  const color = e?.color ?? "#64748b";
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full font-medium", size === "sm" ? "px-2 py-px text-[11.5px]" : "px-2.5 py-0.5 text-[12px]")}
      style={{ color, background: `${color}1a` }}
      title={t("Environment")}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {e?.name ?? env}
    </span>
  );
}

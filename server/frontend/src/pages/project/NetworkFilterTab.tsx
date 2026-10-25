import { useState } from "react";
import { errorText } from "../../api/client";
import { useUpdateProjectSettings } from "../../api/hooks";
import type { ProjectDetails } from "../../api/types";
import { Button, ErrorBox, Input } from "../../components/ui";
import { t } from "../../i18n";

const EXAMPLES = ["collector.github.com", "*/metrics*", "https://mc.yandex.ru/*", "/api/health"];

/** Network filter: requests the extension does not record (telemetry, pings, counters). */
export function NetworkFilterTab({ d }: { d: ProjectDetails }) {
  const save = useUpdateProjectSettings(d.project.id);
  const [value, setValue] = useState("");
  const list = d.networkIgnore;

  const update = (next: string[]) => save.mutate(next);
  const add = (raw: string) => {
    const items = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s && !list.includes(s));
    if (items.length) update([...list, ...items]);
    setValue("");
  };

  return (
    <div className="max-w-[760px] space-y-4">
      <div className="rounded-panel border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted">
        {t("Requests to these addresses are not recorded in this project's reports — telemetry, pings and counters that only get in the way. The list is loaded when a recording starts.")}
        <ul className="mt-2 space-y-0.5">
          <li>
            {t("Without a star — part of the address:")} <code className="font-mono text-ink">collector.github.com</code>
          </li>
          <li>
            {t("With a star — a pattern for the whole address:")} <code className="font-mono text-ink">*/metrics*</code>,{" "}
            <code className="font-mono text-ink">https://*.yandex.ru/*</code>
          </li>
        </ul>
      </div>

      <div className="rounded-panel border border-line bg-surface">
        {list.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-faint">{t("The filter is empty — all requests are recorded.")}</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {list.map((p) => (
              <li key={p} className="group flex items-center gap-3 px-4 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{p}</code>
                {d.canManage && (
                  <button
                    onClick={() => update(list.filter((x) => x !== p))}
                    disabled={save.isPending}
                    className="text-[12px] text-faint opacity-0 hover:text-ev-error group-hover:opacity-100 focus:opacity-100"
                  >
                    {t("Delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {d.canManage && (
          <form
            className="flex flex-wrap gap-2 border-t border-line-soft px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              add(value);
            }}
          >
            <Input className="min-w-[240px] flex-1 font-mono" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("e.g. */metrics*")} maxLength={300} />
            <Button type="submit" variant="primary" disabled={!value.trim() || save.isPending}>
              {t("Add")}
            </Button>
          </form>
        )}
      </div>

      {d.canManage && list.length === 0 && (
        <p className="text-[13px] text-faint">
          {t("Common examples:")}{" "}
          {EXAMPLES.map((x, i) => (
            <span key={x}>
              {i > 0 && ", "}
              <button className="font-mono text-primary hover:underline" onClick={() => setValue(x)}>
                {x}
              </button>
            </span>
          ))}
        </p>
      )}
      {!d.canManage && <p className="text-[13px] text-faint">{t("Project owners and maintainers can change the filter.")}</p>}
      {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
    </div>
  );
}

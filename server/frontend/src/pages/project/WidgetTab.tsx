import { useState } from "react";
import { errorText } from "../../api/client";
import { useWidgetKeyMutations, useWidgetKeys } from "../../api/hooks";
import type { WidgetKey } from "../../api/types";
import { Button, cx, ErrorBox, Field, Input, Loading, Modal, Textarea } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import { t } from "../../i18n";

/** The Bug Stream site address as employees see it (the site loads the widget from here). */
const SERVER = window.location.origin;

const snippetHtml = (key: string) => `<script src="${SERVER}/widget/bug-stream.js"></script>
<script>
  bugstream.init({
    server: "${SERVER}",
    key: "${key}",
    user: { id: currentUser.id, email: currentUser.email, name: currentUser.name },
    redactHeaders: ["authorization", "cookie", "set-cookie"],
  });
  // a button on your site:  onclick="bugstream.report()"
</script>`;

/**
 * Site widget: the site includes a script, and its "Report a bug" button works without the extension.
 * The key links the reports to this project.
 */
export function WidgetTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const keys = useWidgetKeys(projectId, canManage);
  const m = useWidgetKeyMutations(projectId);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  if (!canManage) {
    return <p className="text-[13px] text-faint">{t("Project owners and maintainers see and create widget keys.")}</p>;
  }
  if (keys.isLoading) return <Loading />;

  return (
    <div className="max-w-[860px] space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto max-w-[62ch] text-[13px] text-muted">
          {t("The widget is a script your site includes. Its \"Report a bug\" button records video, console, network and the last 2 minutes of the page and sends the report to this project. No extension needed.")}
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t("Create key")}
        </Button>
      </div>

      {keys.error && <ErrorBox>{errorText(keys.error)}</ErrorBox>}
      {keys.data?.length === 0 && (
        <div className="rounded-panel border border-dashed border-line bg-surface px-4 py-8 text-center text-[13px] text-faint">
          {t("No keys. Create one to get ready-to-paste code for your site.")}
        </div>
      )}
      {keys.data?.map((k) => (
        <KeyCard key={k.id} k={k} onToggle={() => m.update.mutate({ id: k.id, enabled: !k.enabled })} onDelete={() => confirm(t("Delete the key \"{name}\"? A widget using it will stop sending reports.", { name: k.name })) && m.remove.mutate(k.id)} onOrigins={(o) => m.update.mutate({ id: k.id, allowedOrigins: o })} />
      ))}
      {(m.update.error || m.remove.error) && <ErrorBox>{errorText(m.update.error ?? m.remove.error)}</ErrorBox>}

      {creating && (
        <CreateKeyModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(raw) => {
            setCreating(false);
            setCreated(raw);
          }}
        />
      )}
      {created && <KeyCreatedModal rawKey={created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function KeyCard({ k, onToggle, onDelete, onOrigins }: { k: WidgetKey; onToggle: () => void; onDelete: () => void; onOrigins: (o: string[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [origins, setOrigins] = useState(k.allowedOrigins.join("\n"));
  return (
    <div className={cx("rounded-panel border border-line bg-surface", !k.enabled && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="font-medium">
            {k.name} {!k.enabled && <span className="ml-1 text-[12px] font-normal text-faint">{t("disabled")}</span>}
          </p>
          <p className="font-mono text-[12px] text-faint">
            {k.keyPrefix}… · {t("created by {name} {when}", { name: k.createdByName ?? "—", when: timeAgo(k.createdAt) })} · {k.lastUsedAt ? t("last report {when}", { when: timeAgo(k.lastUsedAt) }) : t("no reports yet")}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          {t("Sites")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {k.enabled ? t("Disable") : t("Enable")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          {t("Delete")}
        </Button>
      </div>
      <div className="border-t border-line-soft px-4 py-2.5 text-[13px]">
        {editing ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              onOrigins(splitOrigins(origins));
              setEditing(false);
            }}
          >
            <Textarea className="font-mono text-[12.5px]" rows={3} value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder={"https://app.example.com\nhttp://localhost:3000"} />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" type="submit">
                {t("Save")}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                {t("Cancel")}
              </Button>
            </div>
          </form>
        ) : k.allowedOrigins.length ? (
          <span className="text-muted">
            {t("Accepts reports from:")} <span className="font-mono text-ink">{k.allowedOrigins.join(", ")}</span>
          </span>
        ) : (
          <span className="text-ev-warn">{t("Accepts reports from any site — better list your own sites.")}</span>
        )}
      </div>
    </div>
  );
}

const splitOrigins = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim().replace(/\/+$/, ""))
    .filter(Boolean);

function CreateKeyModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: (raw: string) => void }) {
  const m = useWidgetKeyMutations(projectId);
  const [name, setName] = useState("");
  const [origins, setOrigins] = useState("");
  return (
    <Modal open onClose={onClose} title={t("Widget key")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.create.mutate({ name, allowedOrigins: splitOrigins(origins) }, { onSuccess: (r) => onCreated(r.rawKey) });
        }}
      >
        <Field label={t("Name")} hint={t("Which site the key is for, e.g. \"Portal — production\"")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
        </Field>
        <Field label={t("Site addresses")} hint={t("Sites to accept reports from — scheme and host, one per line. A star is allowed: https://*.example.com")}>
          <Textarea className="font-mono text-[12.5px]" rows={3} value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder={"https://app.example.com\nhttp://localhost:3000"} />
        </Field>
        {m.create.error && <ErrorBox>{errorText(m.create.error)}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={m.create.isPending}>
            {t("Create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function KeyCreatedModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <Modal open onClose={onClose} title={t("Key created")}>
      <div className="space-y-3">
        <p className="text-[13px] text-muted">{t("The key is shown only once. It is visible in your site's code — that is fine: it only allows sending reports to this project.")}</p>
        <div className="flex gap-2">
          <Input readOnly className="font-mono" value={rawKey} onFocus={(e) => e.currentTarget.select()} />
          <Button onClick={() => copy("key", rawKey)}>{copied === "key" ? t("Copied") : t("Copy")}</Button>
        </div>
        <p className="text-[13px] font-medium text-muted">{t("Code for your site")}</p>
        <pre className="max-h-[260px] overflow-auto rounded-control bg-ink p-3 font-mono text-[12px] leading-relaxed text-white">{snippetHtml(rawKey)}</pre>
        <div className="flex justify-end gap-2">
          <Button onClick={() => copy("code", snippetHtml(rawKey))}>{copied === "code" ? t("Code copied") : t("Copy code")}</Button>
          <Button variant="primary" onClick={onClose}>
            {t("Done")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

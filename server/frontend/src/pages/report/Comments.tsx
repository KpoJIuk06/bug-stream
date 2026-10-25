import { useMemo, useRef, useState } from "react";
import { errorText } from "../../api/client";
import { useCommentMutations, useComments, useUsers } from "../../api/hooks";
import type { Comment, FileInfo } from "../../api/types";
import { Avatar, Button, cx, ErrorBox, Spinner, Textarea } from "../../components/ui";
import { formatBytes, formatTimecode, timeAgo } from "../../lib/format";
import { t } from "../../i18n";

interface Props {
  reportId: string;
  time: number;
  hasVideo: boolean;
  disabled: boolean;
  onSeek: (ms: number) => void;
}

/** Comments: one level of replies, @mentions, attachments, links to a video moment. */
export function Comments({ reportId, time, hasVideo, disabled, onSeek }: Props) {
  const comments = useComments(reportId);
  const m = useCommentMutations(reportId);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const { roots, replies } = useMemo(() => {
    const list = comments.data ?? [];
    const roots = list.filter((c) => !c.replyTo || !list.some((x) => x.id === c.replyTo));
    const replies = new Map<string, Comment[]>();
    for (const c of list) {
      if (c.replyTo && list.some((x) => x.id === c.replyTo)) {
        // a reply to a reply is shown in the root comment's thread
        let root = c.replyTo;
        let parent = list.find((x) => x.id === root);
        while (parent?.replyTo && list.some((x) => x.id === parent!.replyTo)) {
          root = parent.replyTo;
          parent = list.find((x) => x.id === root);
        }
        replies.set(root, [...(replies.get(root) ?? []), c]);
      }
    }
    return { roots, replies };
  }, [comments.data]);

  if (comments.isLoading) return <Spinner />;

  return (
    <div>
      {roots.length === 0 && <p className="mb-4 text-muted">{t("No comments yet. Describe what you found, or mention a colleague with @.")}</p>}
      <ul className="space-y-4">
        {roots.map((c) => (
          <li key={c.id}>
            <CommentItem c={c} m={m} onReply={() => setReplyTo(c)} onSeek={onSeek} disabled={disabled} />
            {(replies.get(c.id)?.length ?? 0) > 0 && (
              <ul className="ml-[34px] mt-3 space-y-3 border-l-2 border-line-soft pl-4">
                {replies.get(c.id)!.map((r) => (
                  <li key={r.id}>
                    <CommentItem c={r} m={m} onReply={() => setReplyTo(c)} onSeek={onSeek} disabled={disabled} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <Composer
          key={replyTo?.id ?? "root"}
          reportId={reportId}
          time={time}
          hasVideo={hasVideo}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={() => setReplyTo(null)}
        />
      )}
    </div>
  );
}

type Mutations = ReturnType<typeof useCommentMutations>;

function CommentItem({ c, m, onReply, onSeek, disabled }: { c: Comment; m: Mutations; onReply: () => void; onSeek: (ms: number) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const file = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-2.5">
      <Avatar name={c.author.name} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className="font-medium">{c.author.name}</span>
          <span className="text-faint" title={new Date(c.createdAt).toLocaleString("ru")}>
            {timeAgo(c.createdAt)}
          </span>
          {c.editedAt && <span className="text-faint">{t("edited")}</span>}
          {c.videoTMs != null && (
            <button onClick={() => onSeek(c.videoTMs!)} className="rounded bg-primary-soft px-1.5 font-mono text-[12px] text-primary hover:bg-primary hover:text-white" title={t("Go to this moment of the video")}>
              ▶ {formatTimecode(c.videoTMs)}
            </button>
          )}
        </div>
        {editing ? (
          <form
            className="mt-1.5 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              m.update.mutate({ id: c.id, body: text, mentions: c.mentions.map((x) => x.id) }, { onSuccess: () => setEditing(false) });
            }}
          >
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" type="submit" disabled={!text.trim() || m.update.isPending}>
                {t("Save")}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                {t("Cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words">{highlightMentions(c.body, c.mentions)}</p>
        )}
        {c.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {c.attachments.map((a) => (
              <Attachment key={a.id} a={a} />
            ))}
          </div>
        )}
        {!disabled && !editing && (
          <div className="mt-1 flex gap-3 text-[12px] text-faint">
            <button className="hover:text-ink" onClick={onReply}>
              {t("Reply")}
            </button>
            {c.canEdit && (
              <>
                <button className="hover:text-ink" onClick={() => setEditing(true)}>
                  {t("Edit")}
                </button>
                <button className="hover:text-ink" onClick={() => file.current?.click()}>
                  {t("Attach a file")}
                </button>
                <button className="hover:text-ev-error" onClick={() => confirm(t("Delete the comment?")) && m.remove.mutate(c.id)}>
                  {t("Delete")}
                </button>
                <input
                  ref={file}
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) m.attach.mutate({ id: c.id, file: f });
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Attachment({ a }: { a: FileInfo }) {
  const isImage = a.mimeType.startsWith("image/");
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="group flex items-center gap-2 rounded-control border border-line bg-surface p-1.5 pr-3 text-[12px] hover:border-faint">
      {isImage ? (
        <img src={a.url} alt="" className="size-10 rounded object-cover" />
      ) : (
        <span className="grid size-10 place-items-center rounded bg-fog font-mono text-[10px] uppercase text-muted">{a.fileName.split(".").pop()?.slice(0, 4)}</span>
      )}
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate group-hover:underline">{a.fileName}</span>
        <span className="text-faint">{formatBytes(a.sizeBytes)}</span>
      </span>
    </a>
  );
}

function highlightMentions(body: string, mentions: { id: string; name: string }[]) {
  if (!mentions.length) return body;
  const names = mentions.map((m) => m.name).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return body.split(re).map((part, i) =>
    part.startsWith("@") && names.includes(part.slice(1)) ? (
      <span key={i} className="rounded bg-primary-soft px-0.5 font-medium text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function Composer({
  reportId,
  time,
  hasVideo,
  replyTo,
  onCancelReply,
  onSent,
}: {
  reportId: string;
  time: number;
  hasVideo: boolean;
  replyTo: Comment | null;
  onCancelReply: () => void;
  onSent: () => void;
}) {
  const m = useCommentMutations(reportId);
  const users = useUsers();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<{ id: string; name: string }[]>([]);
  const [atMoment, setAtMoment] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const suggestions = mentionQuery == null ? [] : (users.data ?? []).filter((u) => u.fullName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  const onChange = (value: string) => {
    setText(value);
    const caret = area.current?.selectionStart ?? value.length;
    const match = /@([\p{L}\d.\- ]{0,30})$/u.exec(value.slice(0, caret));
    setMentionQuery(match ? match[1] : null);
  };

  const pick = (u: { id: string; fullName: string }) => {
    const caret = area.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}\d.\- ]{0,30})$/u, `@${u.fullName} `);
    setText(before + text.slice(caret));
    if (!mentions.some((x) => x.id === u.id)) setMentions([...mentions, { id: u.id, name: u.fullName }]);
    setMentionQuery(null);
    area.current?.focus();
  };

  const send = () => {
    const used = mentions.filter((x) => text.includes(`@${x.name}`)).map((x) => x.id);
    m.create.mutate(
      { body: text.trim(), replyTo: replyTo?.id ?? null, mentions: used, videoTMs: atMoment ? Math.round(time) : null },
      {
        onSuccess: (list) => {
          // the attachment goes to the comment just created (the last one in the list is ours)
          const mine = list.at(-1);
          if (file && mine) m.attach.mutate({ id: mine.id, file });
          setText("");
          setMentions([]);
          setFile(null);
          setAtMoment(false);
          onSent();
        },
      },
    );
  };

  return (
    <div className="mt-5 rounded-panel border border-line bg-surface focus-within:border-primary">
      {replyTo && (
        <div className="flex items-center justify-between border-b border-line-soft px-3 py-1.5 text-[12px] text-muted">
          <span className="truncate">
            {t("Reply to")} <b className="font-medium text-ink">{replyTo.author.name}</b>: {replyTo.body.slice(0, 80)}
          </span>
          <button onClick={onCancelReply} className="ml-2 text-faint hover:text-ink">
            {t("Cancel")}
          </button>
        </div>
      )}
      <div className="relative">
        <textarea
          ref={area}
          rows={3}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (suggestions.length && (e.key === "Enter" || e.key === "Tab")) {
              e.preventDefault();
              pick(suggestions[0]);
            } else if (e.key === "Escape") setMentionQuery(null);
            else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) send();
          }}
          placeholder={t("Comment. @ to mention a colleague, Ctrl+Enter to send")}
          className="block w-full resize-y rounded-t-panel bg-transparent px-3 py-2.5 leading-relaxed outline-none placeholder:text-faint"
        />
        {suggestions.length > 0 && (
          <ul className="absolute left-3 top-full z-20 -mt-1 w-64 rounded-control border border-line bg-surface py-1 shadow-[0_10px_30px_-10px_rgba(24,32,44,0.3)]">
            {suggestions.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(u);
                  }}
                  className={cx("flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-fog", i === 0 && "bg-fog")}
                >
                  <Avatar name={u.fullName} size={20} />
                  <span className="truncate">{u.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-3 py-2 text-[13px]">
        {hasVideo && (
          <label className="flex cursor-pointer items-center gap-1.5 text-muted">
            <input type="checkbox" checked={atMoment} onChange={(e) => setAtMoment(e.target.checked)} className="accent-primary" />
            {t("at")} <span className="font-mono">{formatTimecode(time)}</span>
          </label>
        )}
        <label className="cursor-pointer text-muted hover:text-ink">
          <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? <span className="text-ink">📎 {file.name}</span> : t("Attach a file")}
        </label>
        {file && (
          <button className="text-faint hover:text-ev-error" onClick={() => setFile(null)}>
            {t("remove")}
          </button>
        )}
        <Button className="ml-auto" size="sm" variant="primary" disabled={!text.trim() || m.create.isPending} onClick={send}>
          {t("Send")}
        </Button>
      </div>
      {(m.create.error || m.attach.error) && (
        <div className="px-3 pb-2">
          <ErrorBox>{errorText(m.create.error ?? m.attach.error)}</ErrorBox>
        </div>
      )}
    </div>
  );
}

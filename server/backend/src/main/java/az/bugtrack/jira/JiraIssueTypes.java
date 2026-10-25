package az.bugtrack.jira;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import az.bugtrack.jira.JiraClient.IssueType;

/**
 * Which issue type a report becomes in a given Jira project. Never fails because of a wrong name:
 * <ol>
 *   <li>the type chosen when sending (if any);</li>
 *   <li>the project's own type (project → Jira &amp; Slack);</li>
 *   <li>the default from Administration → Jira (e.g. "Bug");</li>
 *   <li>a bug-like type of this project, in any language (Bug, Ошибка, Баг, Дефект, Xəta…);</li>
 *   <li>the first standard type (not a sub-task, not an epic).</li>
 * </ol>
 * Names are compared case-insensitively; an id also matches.
 */
public final class JiraIssueTypes {

    /** source: REQUESTED, PROJECT, DEFAULT, BUG_LIKE, FIRST, NAME (types unknown — the name is sent as is). */
    public record Choice(String id, String name, String source) {
    }

    private static final Set<String> BUG_LIKE = Set.of("bug", "defect", "ошибка", "баг", "дефект", "xəta", "səhv", "hata");
    private static final Set<String> NOT_STANDARD = Set.of("epic", "эпик", "epik");

    private JiraIssueTypes() {
    }

    public static Choice pick(List<IssueType> types, String requested, String project, String deflt) {
        List<IssueType> usable = types == null ? List.of() : types.stream().filter(JiraIssueTypes::standard).toList();
        if (usable.isEmpty()) {
            // types are unknown (old sync): send the name and let Jira decide
            String name = first(requested, project, deflt, "Bug");
            return new Choice(null, name, "NAME");
        }
        for (String[] candidate : new String[][] {{requested, "REQUESTED"}, {project, "PROJECT"}, {deflt, "DEFAULT"}}) {
            IssueType t = find(usable, candidate[0]);
            if (t != null) return new Choice(t.id(), t.name(), candidate[1]);
        }
        for (IssueType t : usable) {
            if (BUG_LIKE.contains(t.name().trim().toLowerCase(Locale.ROOT))) return new Choice(t.id(), t.name(), "BUG_LIKE");
        }
        IssueType t = usable.get(0);
        return new Choice(t.id(), t.name(), "FIRST");
    }

    /** Types a report can become: no sub-tasks, no epics. */
    public static boolean standard(IssueType t) {
        if (t.subtask() || t.name() == null) return false;
        if (t.level() != null) return t.level() == 0;
        return !NOT_STANDARD.contains(t.name().trim().toLowerCase(Locale.ROOT));
    }

    private static IssueType find(List<IssueType> types, String wanted) {
        if (wanted == null || wanted.isBlank()) return null;
        String w = wanted.trim();
        for (IssueType t : types) {
            if (t.name().equalsIgnoreCase(w) || w.equals(t.id())) return t;
        }
        return null;
    }

    private static String first(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }
}

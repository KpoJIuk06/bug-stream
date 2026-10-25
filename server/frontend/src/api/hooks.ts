import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "./client";
import type {
  AppNotification,
  Attribute,
  ExternalLink,
  NotificationPrefs,
  JiraStatus,
  JiraProject,
  JiraConnectResult,
  IssueTypeUsage,
  JiraIssueType,
  JiraLinkedProject,
  ProjectGroup,
  ProjectJira,
  MyJira,
  WidgetKey,
  AuditEntry,
  Comment,
  Environment,
  HistoryEntry,
  MatchType,
  Member,
  MemberRole,
  Page,
  ProjectDetails,
  ProjectSummary,
  ReportDetails,
  ReportEvent,
  ReportListItem,
  Service,
  User,
  AppRole,
  Permission,
  AdminOverview,
  AppSettings,
  PublicSettings,
  LdapTestResult,
  AuthAdminView,
  AuthConfig,
  LdapRequest,
  LdapStatus,
  MailRequest,
  MailStatus,
  PasswordLinkInfo,
  Locale,
  Dashboard,
  ReportShare,
  ShareRow,
  SlackStatus,
} from "./types";

// ----------------------------- users -----------------------------

export const useMe = (enabled: boolean) =>
  useQuery({ queryKey: ["me"], queryFn: () => request<User>("/api/auth/me"), enabled, staleTime: 60_000 });

export const useUsers = (q = "", includeInactive = false) =>
  useQuery({
    queryKey: ["users", q, includeInactive],
    queryFn: () => request<User[]>("/api/users", { query: { q, includeInactive } }),
    staleTime: 60_000,
  });

export const useAdminUsers = (q: string, role: string, includeInactive: boolean, page: number, size: number) =>
  useQuery({
    queryKey: ["admin", "users", q, role, includeInactive, page, size],
    queryFn: () =>
      request<Page<User>>("/api/admin/users", { query: { q, role: role || undefined, includeInactive, page, size } }),
    placeholderData: keepPreviousData,
  });

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      password?: string;
      fullName: string;
      role: string;
      authSource: "LOCAL" | "LDAP";
      username?: string;
      invite?: boolean;
    }) => request<User>("/api/admin/users", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; fullName: string; role: string; active: boolean }) =>
      request<User>(`/api/admin/users/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export const useResetPassword = () =>
  useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      request(`/api/admin/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),
  });

export const useSetLocale = () =>
  useMutation({
    mutationFn: (locale: Locale) => request<User>("/api/auth/me/locale", { method: "PUT", body: { locale } }),
  });

export const useAuthConfig = () =>
  useQuery({
    queryKey: ["auth-config"],
    queryFn: () => request<AuthConfig>("/api/auth/config", { auth: false }),
    staleTime: 60_000,
  });

/** Public: e-mail a sign-in code / a password reset link. */
export const useRequestEmailCode = () =>
  useMutation({
    mutationFn: (body: { email: string; locale: string }) =>
      request("/api/auth/email-code", { method: "POST", body, auth: false }),
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (body: { email: string; locale: string }) =>
      request("/api/auth/password/forgot", { method: "POST", body, auth: false }),
  });

export const usePasswordLink = (token: string) =>
  useQuery({
    queryKey: ["password-link", token],
    queryFn: () => request<PasswordLinkInfo>("/api/auth/password/link", { query: { token }, auth: false }),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
  });

// ----------------------------- admin -----------------------------

export const useRoles = (enabled = true) =>
  useQuery({ queryKey: ["admin", "roles"], queryFn: () => request<AppRole[]>("/api/admin/roles"), enabled, staleTime: 60_000 });

export const usePermissions = () =>
  useQuery({ queryKey: ["admin", "permissions"], queryFn: () => request<Permission[]>("/api/admin/permissions"), staleTime: Infinity });

export function useRoleMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["admin"] });
  type Body = { code?: string; name: string; description?: string; permissions: string[] };
  return {
    create: useMutation({ mutationFn: (body: Body) => request<AppRole>("/api/admin/roles", { method: "POST", body }), onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Body & { id: string }) => request<AppRole>(`/api/admin/roles/${id}`, { method: "PATCH", body }),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => request(`/api/admin/roles/${id}`, { method: "DELETE" }), onSuccess: done }),
  };
}

export const useEnvironments = (all = false) =>
  useQuery({
    queryKey: ["environments", all],
    queryFn: () => request<Environment[]>("/api/environments", { query: { all } }),
    staleTime: 5 * 60_000,
  });

export function useEnvironmentMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["environments"] });
  type Body = { code?: string; name: string; color: string; sortOrder: number; active?: boolean };
  return {
    create: useMutation({
      mutationFn: (body: Body) => request<Environment>("/api/admin/environments", { method: "POST", body }),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ code, ...body }: Body & { code: string }) =>
        request<Environment>(`/api/admin/environments/${code}`, { method: "PATCH", body }),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (code: string) => request(`/api/admin/environments/${code}`, { method: "DELETE" }),
      onSuccess: done,
    }),
  };
}

export const useAdminOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: () => request<AdminOverview>("/api/admin/overview") });

export const useAdminSettings = () =>
  useQuery({ queryKey: ["admin", "settings"], queryFn: () => request<AppSettings>("/api/admin/settings") });

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<AppSettings>) => request<AppSettings>("/api/admin/settings", { method: "PUT", body: changes }),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "settings"], data);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export const usePublicSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => request<PublicSettings>("/api/settings"), staleTime: 5 * 60_000 });

export const useAudit = (table: string, page: number, size: number) =>
  useQuery({
    queryKey: ["admin", "audit", table, page, size],
    queryFn: () => request<Page<AuditEntry>>("/api/admin/audit", { query: { table: table || undefined, page, size } }),
    placeholderData: keepPreviousData,
  });

export const useAuditTables = () =>
  useQuery({ queryKey: ["admin", "audit-tables"], queryFn: () => request<string[]>("/api/admin/audit/tables") });

export const useLdapTest = () =>
  useMutation({
    mutationFn: (arg: string | { login: string; config?: LdapRequest }) =>
      request<LdapTestResult>("/api/admin/ldap/test", { method: "POST", body: typeof arg === "string" ? { login: arg } : arg }),
  });

export const useInviteUser = () =>
  useMutation({ mutationFn: (id: string) => request(`/api/admin/users/${id}/invite`, { method: "POST" }) });

// ----------------------------- sign-in methods, SMTP, LDAP -----------------------------

export const useAuthAdmin = () => useQuery({ queryKey: ["admin", "auth"], queryFn: () => request<AuthAdminView>("/api/admin/auth") });

export function useAuthAdminMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "auth"] });
    qc.invalidateQueries({ queryKey: ["auth-config"] });
  };
  return {
    update: useMutation({
      mutationFn: (changes: Partial<AuthAdminView["settings"]>) => request<AuthAdminView>("/api/admin/auth", { method: "PUT", body: changes }),
      onSuccess: (d) => {
        qc.setQueryData(["admin", "auth"], d);
        qc.invalidateQueries({ queryKey: ["auth-config"] });
      },
    }),
    saveLdap: useMutation({
      mutationFn: (body: LdapRequest) => request<LdapStatus>("/api/admin/ldap", { method: "PUT", body }),
      onSuccess: (d) => {
        qc.setQueryData(["admin", "ldap"], d);
        refresh();
      },
    }),
    resetLdap: useMutation({
      mutationFn: () => request<LdapStatus>("/api/admin/ldap", { method: "DELETE" }),
      onSuccess: (d) => {
        qc.setQueryData(["admin", "ldap"], d);
        refresh();
      },
    }),
  };
}

export const useLdapConfig = () => useQuery({ queryKey: ["admin", "ldap"], queryFn: () => request<LdapStatus>("/api/admin/ldap") });

export const useMailConfig = () => useQuery({ queryKey: ["admin", "mail"], queryFn: () => request<MailStatus>("/api/admin/mail") });

export function useMailMutations() {
  const qc = useQueryClient();
  const done = (d: MailStatus) => {
    qc.setQueryData(["admin", "mail"], d);
    qc.invalidateQueries({ queryKey: ["admin", "auth"] });
    qc.invalidateQueries({ queryKey: ["auth-config"] });
  };
  return {
    save: useMutation({ mutationFn: (body: MailRequest) => request<MailStatus>("/api/admin/mail", { method: "PUT", body }), onSuccess: done }),
    reset: useMutation({ mutationFn: () => request<MailStatus>("/api/admin/mail", { method: "DELETE" }), onSuccess: done }),
    test: useMutation({
      mutationFn: (to: string) => request<{ ok: boolean; message: string }>("/api/admin/mail/test", { method: "POST", body: { to } }),
    }),
  };
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: (body: { currentPassword?: string; newPassword: string }) =>
      request("/api/auth/change-password", { method: "POST", body }),
  });

// ----------------------------- projects -----------------------------

export const useProjects = (q = "", includeArchived = false) =>
  useQuery({
    queryKey: ["projects", q, includeArchived],
    queryFn: () => request<ProjectSummary[]>("/api/projects", { query: { q, includeArchived } }),
    staleTime: 30_000,
  });

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: ["project", id],
    queryFn: () => request<ProjectDetails>(`/api/projects/${id}`),
    enabled: !!id,
  });

export const useProjectMembers = (id: string) =>
  useQuery({ queryKey: ["project", id, "members"], queryFn: () => request<Member[]>(`/api/projects/${id}/members`) });

export const useProjectHistory = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["project", id, "history"],
    queryFn: () => request<AuditEntry[]>(`/api/projects/${id}/history`, { query: { limit: 200 } }),
    enabled,
  });

function useInvalidateProject() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    if (id) qc.invalidateQueries({ queryKey: ["project", id] });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: (body: { key: string; name: string; description?: string }) =>
      request<ProjectDetails>("/api/projects", { method: "POST", body }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: (body: { name: string; description: string; visibility: "PUBLIC" | "PRIVATE" }) =>
      request<ProjectDetails>(`/api/projects/${id}`, { method: "PATCH", body }),
    onSuccess: () => invalidate(id),
  });
}

export function useArchiveProject(id: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: (archive: boolean) =>
      request<ProjectDetails>(`/api/projects/${id}/${archive ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: () => invalidate(id),
  });
}

export function useSetMember(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      request<Member[]>(`/api/projects/${projectId}/members/${userId}`, { method: "PUT", body: { role } }),
    onSuccess: () => invalidate(projectId),
  });
}

export function useRemoveMember(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: (userId: string) =>
      request<Member[]>(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(projectId),
  });
}

export function useCreateService(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: (body: {
      code: string;
      name: string;
      description?: string;
      environment: string;
      patterns?: { matchType: MatchType; pattern: string; priority?: number }[];
    }) => request<Service>(`/api/projects/${projectId}/services`, { method: "POST", body }),
    onSuccess: () => invalidate(projectId),
  });
}

export function useUpdateService(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; description: string; environment: string }) =>
      request<Service>(`/api/services/${id}`, { method: "PATCH", body }),
    onSuccess: () => invalidate(projectId),
  });
}

export function useArchiveService(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      request<Service>(`/api/services/${id}/${archive ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: () => invalidate(projectId),
  });
}

export function useAddPattern(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: ({ serviceId, ...body }: { serviceId: string; matchType: MatchType; pattern: string; priority?: number }) =>
      request<Service>(`/api/services/${serviceId}/patterns`, { method: "POST", body }),
    onSuccess: () => invalidate(projectId),
  });
}

export function useDeletePattern(projectId: string) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: (patternId: string) => request<Service>(`/api/url-patterns/${patternId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(projectId),
  });
}

// ----------------------------- reports -----------------------------

export interface ReportFilters {
  projectId?: string;
  serviceId?: string;
  status?: string[];
  severity?: string[];
  environment?: string[];
  authorId?: string;
  assigneeId?: string;
  tag?: string[];
  hasErrors?: boolean;
  from?: string;
  to?: string;
  q?: string;
  includeDeleted?: boolean;
  sort?: string;
  page?: number;
  size?: number;
  /** NONE | TODO | IN_PROGRESS | DONE — by the Jira issue status. */
  jira?: string[];
  noProject?: boolean;
}

/** All reports grouped by project (same filters, without project / paging). */
export const useReportGroups = (filters: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: ["reports", "groups", filters],
    queryFn: () => {
      const { projectId: _p, serviceId: _s, page: _pg, size: _sz, sort: _so, noProject: _n, includeDeleted: _d, ...rest } = filters;
      return request<ProjectGroup[]>("/api/reports/groups", { query: { ...rest } });
    },
    placeholderData: keepPreviousData,
    enabled,
  });

export const useReports = (filters: ReportFilters, enabled = true) =>
  useQuery({
    queryKey: ["reports", filters],
    queryFn: () => request<Page<ReportListItem>>("/api/reports", { query: { ...filters } }),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useReport = (id: string | undefined) =>
  useQuery({
    queryKey: ["report", id],
    queryFn: () => request<ReportDetails>(`/api/reports/${id}`),
    enabled: !!id,
  });

export const useReportEvents = (id: string | undefined) =>
  useQuery({
    queryKey: ["report", id, "events"],
    queryFn: () => request<ReportEvent[]>(`/api/reports/${id}/events`),
    enabled: !!id,
    staleTime: Infinity, // events never change after upload
  });

export const useReportHistory = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["report", id, "history"],
    queryFn: () => request<HistoryEntry[]>(`/api/reports/${id}/history`),
    enabled,
  });

export const useAttributes = (projectId?: string | null) =>
  useQuery({
    queryKey: ["attributes", "report", projectId ?? null],
    queryFn: () =>
      request<Attribute[]>("/api/attributes", { query: { entityType: "report", projectId: projectId ?? undefined } }),
    staleTime: 5 * 60_000,
  });

export function useUpdateReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fields?: Record<string, unknown>; projectId?: string; serviceId?: string | null; clearProject?: boolean }) =>
      request<ReportDetails>(`/api/reports/${id}`, { method: "PATCH", body }),
    onSuccess: (data) => {
      qc.setQueryData(["report", id], data);
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["report", id, "history"] });
    },
  });
}

export function useDeleteReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deleted: boolean) =>
      request<ReportDetails>(`/api/reports/${id}${deleted ? "" : "/restore"}`, { method: deleted ? "DELETE" : "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(["report", id], data);
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

// ----------------------------- comments -----------------------------

export const useComments = (reportId: string) =>
  useQuery({ queryKey: ["report", reportId, "comments"], queryFn: () => request<Comment[]>(`/api/reports/${reportId}/comments`) });

export function useCommentMutations(reportId: string) {
  const qc = useQueryClient();
  const key = ["report", reportId, "comments"];
  const set = (data: Comment[]) => {
    qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ["reports"] });
  };
  return {
    create: useMutation({
      mutationFn: (body: { body: string; replyTo?: string | null; mentions?: string[]; videoTMs?: number | null }) =>
        request<Comment[]>(`/api/reports/${reportId}/comments`, { method: "POST", body }),
      onSuccess: set,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; body: string; mentions?: string[] }) =>
        request<Comment[]>(`/api/comments/${id}`, { method: "PATCH", body }),
      onSuccess: set,
    }),
    remove: useMutation({
      mutationFn: (id: string) => request<Comment[]>(`/api/comments/${id}`, { method: "DELETE" }),
      onSuccess: set,
    }),
    attach: useMutation({
      mutationFn: ({ id, file }: { id: string; file: File }) => {
        const fd = new FormData();
        fd.append("file", file);
        return request<Comment[]>(`/api/comments/${id}/attachments`, { method: "POST", body: fd });
      },
      onSuccess: set,
    }),
  };
}

// ----------------------------- project network filter -----------------------------

export function useUpdateProjectSettings(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (networkIgnore: string[]) =>
      request<ProjectDetails>(`/api/projects/${id}/settings`, { method: "PUT", body: { networkIgnore } }),
    onSuccess: (data) => qc.setQueryData(["project", id], data),
  });
}

// ----------------------------- notifications -----------------------------

/** Unread counter: polled every 30 seconds and when the tab gets focus. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => request<{ count: number }>("/api/notifications/unread-count"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    select: (d) => d.count,
  });

export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => request<AppNotification[]>("/api/notifications", { query: { limit: 50 } }),
    enabled,
  });

export function useReadNotifications() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  return {
    one: useMutation({ mutationFn: (id: string) => request(`/api/notifications/${id}/read`, { method: "POST" }), onSuccess: done }),
    all: useMutation({ mutationFn: () => request("/api/notifications/read-all", { method: "POST" }), onSuccess: done }),
  };
}

export const useNotificationPrefs = (enabled: boolean) =>
  useQuery({ queryKey: ["me", "prefs"], queryFn: () => request<NotificationPrefs>("/api/auth/me/preferences"), enabled });

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { emailNotifications?: boolean; slackNotifications?: boolean }) =>
      request<NotificationPrefs>("/api/auth/me/preferences", { method: "PUT", body }),
    onSuccess: (data) => qc.setQueryData(["me", "prefs"], data),
  });
}

// ----------------------------- Jira -----------------------------

export const useJiraStatus = () => useQuery({ queryKey: ["jira", "status"], queryFn: () => request<JiraStatus>("/api/admin/jira") });

export function useJiraAdmin() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["jira"] });
  return {
    save: useMutation({
      mutationFn: (body: { baseUrl: string; email: string; token?: string; defaultIssueType?: string; environmentField?: string }) =>
        request<JiraStatus>("/api/admin/jira", { method: "PUT", body }),
      onSuccess: (d) => {
        qc.setQueryData(["jira", "status"], d);
        done();
      },
    }),
    remove: useMutation({ mutationFn: () => request("/api/admin/jira", { method: "DELETE" }), onSuccess: done }),
    test: useMutation({ mutationFn: () => request<{ accountId: string; displayName: string; email: string }>("/api/admin/jira/test", { method: "POST" }) }),
    sync: useMutation({ mutationFn: () => request<{ total: number; added: number }>("/api/admin/jira/sync", { method: "POST" }), onSuccess: done }),
    connect: useMutation({
      mutationFn: (jiraProjectIds: string[]) =>
        request<JiraConnectResult[]>("/api/admin/jira/projects/connect", { method: "POST", body: { jiraProjectIds } }),
      onSuccess: () => {
        done();
        qc.invalidateQueries({ queryKey: ["projects"] });
      },
    }),
  };
}

export const useJiraProjects = (q: string, filter: "all" | "linked" | "unlinked", enabled = true) =>
  useQuery({
    queryKey: ["jira", "projects", q, filter],
    queryFn: () => request<JiraProject[]>("/api/admin/jira/projects", { query: { q, filter } }),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useJiraPickerProjects = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: ["jira", "picker", q],
    queryFn: () => request<JiraProject[]>("/api/jira/projects", { query: { q } }),
    enabled,
    placeholderData: keepPreviousData,
  });

export function useLinkProjectJira(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { jiraProjectId: string | null; issueType?: string | null }) =>
      request(`/api/projects/${projectId}/jira`, { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["jira"] });
    },
  });
}

export const useProjectJira = (projectId: string) =>
  useQuery({ queryKey: ["jira", "project", projectId], queryFn: () => request<ProjectJira>(`/api/projects/${projectId}/jira`) });

export const useRefreshIssueTypes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jiraProjectId: string) =>
      request<JiraIssueType[]>(`/api/jira/projects/${jiraProjectId}/issue-types/refresh`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jira"] }),
  });
};

export const useIssueTypeUsage = (enabled = true) =>
  useQuery({ queryKey: ["jira", "issue-types"], queryFn: () => request<IssueTypeUsage[]>("/api/admin/jira/issue-types"), enabled });

export const useJiraLinked = (q: string, enabled = true) =>
  useQuery({
    queryKey: ["jira", "linked", q],
    queryFn: () => request<JiraLinkedProject[]>("/api/admin/jira/linked", { query: { q } }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useBulkIssueType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { projectIds?: string[]; issueType: string | null }) =>
      request<{ updated: number }>("/api/admin/jira/linked/issue-type", { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jira"] }),
  });
};

export const useRefreshJiraLinks = (reportId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request<ExternalLink[]>(`/api/reports/${reportId}/links/refresh`, { method: "POST" }),
    onSuccess: (d) => {
      qc.setQueryData(["report", reportId, "links"], d);
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
};

export const useMyJira = () => useQuery({ queryKey: ["me", "jira"], queryFn: () => request<MyJira>("/api/me/jira"), staleTime: 60_000 });

export function useMyJiraMutations() {
  const qc = useQueryClient();
  return {
    save: useMutation({
      mutationFn: (body: { email: string; token: string }) => request<MyJira>("/api/me/jira", { method: "PUT", body }),
      onSuccess: (d) => qc.setQueryData(["me", "jira"], d),
    }),
    remove: useMutation({
      mutationFn: () => request("/api/me/jira", { method: "DELETE" }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "jira"] }),
    }),
  };
}

export const useReportLinks = (reportId: string) =>
  useQuery({ queryKey: ["report", reportId, "links"], queryFn: () => request<ExternalLink[]>(`/api/reports/${reportId}/links`) });

export function useSendToJira(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueType?: string) => request<ExternalLink>(`/api/reports/${reportId}/jira`, { method: "POST", body: { issueType } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report", reportId, "links"] });
      qc.invalidateQueries({ queryKey: ["me", "jira"] });
    },
    onError: () => qc.invalidateQueries({ queryKey: ["me", "jira"] }),
  });
}

// ----------------------------- site widget -----------------------------

export const useWidgetKeys = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["project", projectId, "widget-keys"],
    queryFn: () => request<WidgetKey[]>(`/api/projects/${projectId}/widget-keys`),
    enabled,
  });

export function useWidgetKeyMutations(projectId: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["project", projectId, "widget-keys"] });
  return {
    create: useMutation({
      mutationFn: (body: { name: string; allowedOrigins: string[] }) =>
        request<{ key: WidgetKey; rawKey: string }>(`/api/projects/${projectId}/widget-keys`, { method: "POST", body }),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; name?: string; allowedOrigins?: string[]; enabled?: boolean }) =>
        request<WidgetKey>(`/api/widget-keys/${id}`, { method: "PATCH", body }),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => request(`/api/widget-keys/${id}`, { method: "DELETE" }), onSuccess: done }),
  };
}

// ----------------------------- dashboard -----------------------------

export const useDashboard = (projectId: string | undefined, days: number) =>
  useQuery({
    queryKey: ["dashboard", projectId ?? null, days],
    queryFn: () => request<Dashboard>("/api/dashboard", { query: { projectId, days } }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

// ----------------------------- sharing -----------------------------

export const useReportShare = (reportId: string) =>
  useQuery({
    queryKey: ["report", reportId, "share"],
    queryFn: () => request<ReportShare | undefined>(`/api/reports/${reportId}/share`).then((r) => r ?? null),
  });

export function useShareMutations(reportId: string) {
  const qc = useQueryClient();
  const key = ["report", reportId, "share"];
  return {
    share: useMutation({
      mutationFn: (days: number) => request<ReportShare>(`/api/reports/${reportId}/share`, { method: "PUT", body: { days } }),
      onSuccess: (d) => qc.setQueryData(key, d),
    }),
    revoke: useMutation({
      mutationFn: () => request(`/api/reports/${reportId}/share`, { method: "DELETE" }),
      onSuccess: () => qc.setQueryData(key, null),
    }),
  };
}

export const useActiveShares = () => useQuery({ queryKey: ["admin", "shares"], queryFn: () => request<ShareRow[]>("/api/admin/shares") });

export function useRevokeShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/api/admin/shares/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "shares"] }),
  });
}

// ----------------------------- Slack -----------------------------

export const useSlackStatus = () => useQuery({ queryKey: ["slack"], queryFn: () => request<SlackStatus>("/api/admin/slack") });

export function useSlackAdmin() {
  const qc = useQueryClient();
  return {
    save: useMutation({
      mutationFn: (body: { botToken?: string; defaultChannel?: string }) => request<SlackStatus>("/api/admin/slack", { method: "PUT", body }),
      onSuccess: (d) => qc.setQueryData(["slack"], d),
    }),
    remove: useMutation({ mutationFn: () => request("/api/admin/slack", { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["slack"] }) }),
    test: useMutation({ mutationFn: (channel?: string) => request("/api/admin/slack/test", { method: "POST", body: { channel } }) }),
  };
}

export const useProjectSlack = (projectId: string) =>
  useQuery({ queryKey: ["project", projectId, "slack"], queryFn: () => request<{ channel: string | null }>(`/api/projects/${projectId}/slack`) });

export function useSetProjectSlack(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: string) => request<{ channel: string | null }>(`/api/projects/${projectId}/slack`, { method: "PUT", body: { channel } }),
    onSuccess: (d) => qc.setQueryData(["project", projectId, "slack"], d),
  });
}

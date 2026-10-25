// Backend response types (see README, API section).

export type MemberRole = "OWNER" | "MAINTAINER" | "MEMBER" | "VIEWER";
export type MatchType = "HOST" | "PREFIX" | "REGEX";
export type EventKind = "CONSOLE" | "NETWORK" | "ACTION" | "NAVIGATION" | "CUSTOM";

export type Locale = "en" | "ru" | "az";

export interface User {
  id: string;
  email: string;
  fullName: string;
  /** Role code (ADMIN, DEVELOPER, ...); roles are managed in the admin panel. */
  role: string;
  roleName: string | null;
  active: boolean;
  authSource: "LOCAL" | "LDAP";
  username: string | null;
  locale: Locale;
  createdAt: string;
  lastLoginAt: string | null;
  /** false — a local account without a password yet (invitation pending or created by an e-mail code). */
  passwordSet: boolean;
  /** Only for the signed-in user. */
  permissions: string[] | null;
}

export interface Environment {
  id: string;
  code: string;
  name: string;
  color: string;
  sortOrder: number;
  active: boolean;
  servicesCount: number;
  reportsCount: number;
  createdAt: string;
}

export interface Permission {
  code: string;
  category: "admin" | "project" | "report";
}

export interface AppRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
  usersCount: number;
  createdAt: string;
}

export interface AdminOverview {
  users: number;
  activeUsers: number;
  ldapUsers: number;
  projects: number;
  reports: number;
  reportsLast7Days: number;
  storageBytes: number;
  ldapEnabled: boolean;
  mailEnabled: boolean;
  publicUrl: string;
}

export type AppSettings = Record<string, unknown> & {
  "sharing.enabled": boolean;
  "sharing.defaultDays": number;
  "sharing.maxDays": number;
  "sharing.networkBodies": boolean;
};

export interface PublicSettings {
  sharingEnabled: boolean;
  sharingDefaultDays: number;
  sharingMaxDays: number;
}

/** GET /api/auth/config — sign-in methods offered on the sign-in page. */
export interface AuthConfig {
  password: boolean;
  passwordReset: boolean;
  ldap: boolean;
  emailCode: boolean;
  ldapEnabled: boolean;
}

export interface AuthAdminView {
  settings: {
    "auth.password.enabled": boolean;
    "auth.password.reset": boolean;
    "auth.ldap.enabled": boolean;
    "auth.emailCode.enabled": boolean;
    "auth.emailCode.domains": string[];
    "auth.emailCode.autoCreate": boolean;
    "auth.emailCode.defaultRole": string;
  };
  effective: { password: boolean; passwordReset: boolean; ldap: boolean; emailCode: boolean };
  mailConfigured: boolean;
  mailSource: "DB" | "ENV" | "NONE";
  ldapConfigured: boolean;
  ldapSource: "DB" | "ENV" | "NONE";
}

export interface MailStatus {
  configured: boolean;
  source: "DB" | "ENV" | "NONE";
  host: string | null;
  port: number | null;
  security: "NONE" | "STARTTLS" | "SSL" | null;
  username: string | null;
  passwordSet: boolean;
  fromAddress: string | null;
  fromName: string | null;
  updatedAt: string | null;
}

export interface MailRequest {
  host: string;
  port: number;
  security: "NONE" | "STARTTLS" | "SSL";
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

export interface LdapRequest {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  emailAttribute: string;
  nameAttribute: string;
  usernameAttribute: string;
  groupRoles: string;
  defaultRole: string;
}

export interface LdapStatus extends Omit<LdapRequest, "bindPassword"> {
  configured: boolean;
  source: "DB" | "ENV" | "NONE";
  bindPasswordSet: boolean;
  updatedAt: string | null;
}

/** GET /api/auth/password/link — what the "set password" page shows. */
export interface PasswordLinkInfo {
  purpose: "RESET" | "INVITE";
  email: string;
  fullName: string;
}

export interface LdapTestResult {
  ok: boolean;
  message: string;
  user: { dn: string; username: string | null; email: string; fullName: string; groups: string[] } | null;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface Ref {
  id: string;
  name: string;
}

export interface ProjectRef {
  id: string;
  key: string;
  name: string;
}

// ----------------------------- projects -----------------------------

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  servicesCount: number;
  membersCount: number;
  reportsCount: number;
  myRole: MemberRole | null;
  /** Jira project linked to this project (synced from Jira). */
  jiraProjectKey?: string | null;
  jiraProjectId?: string | null;
}

export interface UrlPattern {
  id: string;
  serviceId: string;
  matchType: MatchType;
  pattern: string;
  priority: number;
}

export interface Service {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  environment: string;
  createdAt: string;
  archivedAt: string | null;
  patterns: UrlPattern[];
}

export interface ProjectDetails {
  project: ProjectSummary;
  services: Service[];
  canManage: boolean;
  /** Network filter: the extension does not record these requests. */
  networkIgnore: string[];
}

export interface Member {
  userId: string;
  email: string;
  fullName: string;
  userRole: string;
  userActive: boolean;
  projectRole: MemberRole;
  addedAt: string;
}

export interface AuditEntry {
  id: string;
  tableName: string;
  rowId: string | null;
  projectId?: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
}

// ----------------------------- reports -----------------------------

export interface ReportListItem {
  id: string;
  project: ProjectRef | null;
  service: Ref | null;
  author: Ref;
  assignee: Ref | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: string;
  severity: string | null;
  environment: string | null;
  pageUrl: string;
  browser: string | null;
  os: string | null;
  durationMs: number;
  consoleErrors: number;
  networkErrors: number;
  commentsCount: number;
  thumbnailUrl: string | null;
  tags: string[];
  /** The latest Jira issue of the report and its status (refreshed in the background). */
  jira: JiraRef | null;
}

/** category: new (To Do) | indeterminate (In Progress) | done (Done); null until the first sync. */
export interface JiraRef {
  key: string;
  url: string;
  status: string | null;
  category: "new" | "indeterminate" | "done" | null;
}

/** All reports → by project. project null — reports without a project. */
export interface ProjectGroup {
  project: ProjectRef | null;
  jiraProjectKey: string | null;
  total: number;
  newCount: number;
  inProgress: number;
  done: number;
  withErrors: number;
  critical: number;
  inJira: number;
  jiraDone: number;
  lastAt: string;
  thumbnails: string[];
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface FileInfo {
  id: string;
  kind: "VIDEO" | "SCREENSHOT" | "THUMBNAIL" | "ATTACHMENT" | "AVATAR" | "REPLAY";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  url: string;
}

export interface ReportSummary {
  durationMs: number;
  eventsTotal: number;
  consoleErrors: number;
  consoleWarnings: number;
  networkTotal: number;
  networkErrors: number;
  actionsTotal: number;
}

/** Report fields: attribute codes → values (see /api/attributes). */
export type ReportFields = Record<string, unknown> & {
  title?: string;
  description?: string;
  status?: string;
  severity?: string;
  environment?: string;
  assignee_id?: string;
  tags?: string[];
  page_url?: string;
};

export interface ReportDetails {
  id: string;
  project: ProjectRef | null;
  service: Ref | null;
  author: Ref;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  fields: ReportFields;
  summary: ReportSummary;
  files: FileInfo[];
  canDelete: boolean;
  canEdit: boolean;
}

export interface ReportEvent {
  id: string;
  kind: EventKind;
  t: number;
  ts: string;
  level: string | null;
  summary: string;
  method: string | null;
  status: number | null;
  duration: number | null;
  payload: Record<string, unknown>;
}

export interface HistoryEntry {
  id: string;
  action: "CREATE" | "SET" | "UPDATE" | "UNSET" | "DELETE" | "RESTORE" | "MOVE" | "PURGE";
  field: string | null;
  fieldLabel: string | null;
  oldValue: unknown;
  newValue: unknown;
  changedBy: Ref | null;
  changedAt: string;
}

export interface Attribute {
  id: string;
  entityType: string;
  projectId: string | null;
  code: string;
  label: string;
  dataType: "STRING" | "TEXT" | "INT" | "DECIMAL" | "BOOL" | "TIMESTAMP" | "UUID" | "JSON";
  required: boolean;
  multi: boolean;
  filterable: boolean;
  system: boolean;
  options: string[] | null;
  sortOrder: number;
}

export interface Comment {
  id: string;
  replyTo: string | null;
  author: Ref;
  createdAt: string;
  editedAt: string | null;
  body: string;
  videoTMs: number | null;
  mentions: Ref[];
  attachments: FileInfo[];
  canEdit: boolean;
}

export interface ApiProblem {
  status: number;
  code?: string;
  detail?: string;
  fields?: Record<string, string>;
}

// ----------------------------- notifications -----------------------------

export type NotificationType = "MENTION" | "ASSIGNED" | "STATUS_CHANGED" | "COMMENT" | "REPORT_CREATED";

export interface AppNotification {
  id: string;
  type: NotificationType;
  reportId: string | null;
  commentId: string | null;
  actorId: string | null;
  actorName: string | null;
  reportTitle: string | null;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPrefs {
  emailNotifications: boolean;
  /** SMTP is configured on the server — otherwise no e-mails are sent. */
  emailConfigured: boolean;
  slackNotifications: boolean;
  slackConfigured: boolean;
}

// ----------------------------- Jira -----------------------------

export interface JiraStatus {
  configured: boolean;
  baseUrl: string | null;
  serviceEmail: string | null;
  defaultIssueType: string;
  environmentField: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  projectsCount: number;
  linkedCount: number;
  usersWithTokens: number;
  statusSyncAt: string | null;
  statusSyncError: string | null;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
  level: number | null;
}

/** source: REQUESTED | PROJECT | DEFAULT | BUG_LIKE | FIRST | NAME — why this type is used. */
export interface IssueTypeChoice {
  id: string | null;
  name: string;
  source: "REQUESTED" | "PROJECT" | "DEFAULT" | "BUG_LIKE" | "FIRST" | "NAME";
}

export interface IssueTypeUsage {
  name: string;
  linkedProjects: number;
  allProjects: number;
}

export interface JiraLinkedProject {
  projectId: string;
  projectKey: string;
  projectName: string;
  jiraProjectId: string;
  jiraProjectKey: string;
  issueType: string | null;
  issueTypes: JiraIssueType[];
  effective: IssueTypeChoice;
}

export interface ProjectJira {
  configured: boolean;
  jiraProjectId: string | null;
  jiraProjectKey: string | null;
  jiraProjectName: string | null;
  issueType: string | null;
  defaultIssueType: string;
  issueTypes: JiraIssueType[];
  effective: IssueTypeChoice | null;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectType: string | null;
  avatarUrl: string | null;
  issueTypes: JiraIssueType[];
  syncedAt: string;
  removedAt: string | null;
  linkedProjectId: string | null;
  linkedProjectKey: string | null;
  linkedProjectName: string | null;
  linkedIssueType: string | null;
}

export interface JiraConnectResult {
  jiraKey: string;
  projectId: string;
  projectKey: string;
  outcome: "CREATED" | "LINKED" | "ALREADY_LINKED";
}

export interface MyJira {
  configured: boolean;
  baseUrl: string | null;
  connected: boolean;
  invalid: boolean;
  email: string | null;
  displayName: string | null;
  verifiedAt: string | null;
}

export interface ExternalLink {
  id: string;
  type: string;
  externalKey: string;
  externalUrl: string;
  createdByName: string | null;
  createdAt: string;
  statusName: string | null;
  statusCategory: "new" | "indeterminate" | "done" | null;
  statusSyncedAt: string | null;
  missingAt: string | null;
}

// ----------------------------- site widget -----------------------------

export interface WidgetKey {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  allowedOrigins: string[];
  enabled: boolean;
  createdByName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

// ----------------------------- dashboard -----------------------------

export interface DashboardBucket {
  key: string;
  label: string;
  count: number;
}

export interface Dashboard {
  days: number;
  counters: {
    open: number;
    createdInPeriod: number;
    createdPrevPeriod: number;
    resolvedInPeriod: number;
    unassignedOpen: number;
    assignedToMeOpen: number;
    criticalOpen: number;
  };
  byStatus: DashboardBucket[];
  bySeverity: DashboardBucket[];
  byEnvironment: DashboardBucket[];
  byProject: DashboardBucket[];
  topReporters: DashboardBucket[];
  perDay: { day: string; created: number; resolved: number }[];
  topErrors: { kind: "CONSOLE" | "NETWORK"; summary: string; reports: number; events: number; lastSeen: string; sampleReportId: string }[];
  myQueue: { id: string; title: string; status: string; severity: string | null; projectKey: string | null; createdAt: string }[];
  recentJira: { reportId: string; reportTitle: string; key: string; url: string; createdBy: string | null; createdAt: string }[];
}

// ----------------------------- sharing & Slack -----------------------------

export interface ReportShare {
  id: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  createdByName: string | null;
  views: number;
  lastViewedAt: string | null;
}

export interface ShareRow {
  id: string;
  reportId: string;
  reportTitle: string;
  projectKey: string | null;
  createdByName: string | null;
  createdAt: string;
  expiresAt: string;
  views: number;
  lastViewedAt: string | null;
}

export interface SlackStatus {
  configured: boolean;
  teamName: string | null;
  defaultChannel: string | null;
  updatedAt: string | null;
}

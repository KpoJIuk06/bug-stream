// Labels of codes for the interface. Values are English and are translated on read (see i18n/labels).
import { labels, t } from "../i18n";

export const STATUS_LABEL = labels({
  NEW: "New",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
} as Record<string, string>);

export const SEVERITY_LABEL = labels({
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
} as Record<string, string>);

export const MEMBER_ROLE_LABEL = labels({
  OWNER: "Owner",
  MAINTAINER: "Maintainer",
  MEMBER: "Member",
  VIEWER: "Viewer",
} as Record<string, string>);

export const AUTH_SOURCE_LABEL = labels({
  LOCAL: "Local account",
  LDAP: "Active Directory",
} as Record<string, string>);

export const PERMISSION_LABEL = labels({
  "admin.access": "Open the admin panel",
  "user.manage": "Manage users",
  "role.manage": "Manage roles and permissions",
  "environment.manage": "Manage environments",
  "integration.manage": "Manage the Jira connection",
  "settings.manage": "Change global settings",
  "audit.view": "View the audit log",
  "project.create": "Create projects",
  "project.manage_all": "Manage any project",
  "project.view_all": "See private projects",
  "report.create": "Create reports",
  "report.edit": "Edit any report (status, assignee, fields)",
  "report.delete_all": "Delete any report",
  "report.share": "Share reports by public link",
  "report.send_tracker": "Send reports to Jira",
  "comment.delete_all": "Delete other people's comments",
} as Record<string, string>);

export const PERMISSION_CATEGORY_LABEL = labels({
  admin: "Administration",
  project: "Projects",
  report: "Reports",
} as Record<string, string>);

export const MATCH_TYPE_HINT: Record<string, { label: string; placeholder: string; hint: string }> = new Proxy(
  {
    HOST: { label: "Host", placeholder: "10.0.0.15:8080", hint: "Host and port; without a port — any port" },
    PREFIX: { label: "URL prefix", placeholder: "http://10.0.0.15:8080/admin", hint: "The page address starts with this string" },
    REGEX: { label: "Regular expression", placeholder: "^https?://test-.*\\.corp\\.local/", hint: "Searched in the full address" },
  } as Record<string, { label: string; placeholder: string; hint: string }>,
  {
    get(target, prop) {
      const v = target[prop as string];
      return v ? { label: t(v.label), placeholder: v.placeholder, hint: t(v.hint) } : undefined;
    },
  },
);

export const EVENT_KIND_LABEL = labels({
  CONSOLE: "Console",
  NETWORK: "Network",
  ACTION: "Action",
  NAVIGATION: "Navigation",
  CUSTOM: "Custom log",
} as Record<string, string>);

/** Report field names in the history and the Info tab. */
export const FIELD_LABEL = labels({
  title: "Title",
  description: "Description",
  status: "Status",
  severity: "Severity",
  environment: "Environment",
  assignee_id: "Assignee",
  tags: "Tags",
  source: "Source",
  page_url: "URL",
  page_title: "Page title",
  recorded_at: "Recorded at",
  timezone: "Time zone",
  locale: "Language",
  location: "Location",
  os: "OS",
  os_version: "OS version",
  browser: "Browser",
  browser_version: "Browser version",
  window_size: "Window size",
  screen_size: "Screen size",
  device_pixel_ratio: "Pixel ratio",
  network_type: "Network type",
  network_downlink: "Network speed",
  network_rtt: "Network latency",
  extension_version: "Extension version",
} as Record<string, string>);

export function valueLabel(field: string | null, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "status" && typeof value === "string") return STATUS_LABEL[value] ?? value;
  if (field === "severity" && typeof value === "string") return SEVERITY_LABEL[value] ?? value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

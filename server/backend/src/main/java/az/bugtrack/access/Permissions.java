package az.bugtrack.access;

/**
 * Permission codes. The list itself lives in the {@code permission} table (V10);
 * roles and their permissions are edited in the admin panel.
 */
public final class Permissions {

    private Permissions() {
    }

    public static final String ADMIN_ACCESS = "admin.access";
    public static final String USER_MANAGE = "user.manage";
    public static final String ROLE_MANAGE = "role.manage";
    public static final String ENVIRONMENT_MANAGE = "environment.manage";
    public static final String INTEGRATION_MANAGE = "integration.manage";
    public static final String SETTINGS_MANAGE = "settings.manage";
    public static final String AUDIT_VIEW = "audit.view";

    public static final String PROJECT_CREATE = "project.create";
    public static final String PROJECT_MANAGE_ALL = "project.manage_all";
    public static final String PROJECT_VIEW_ALL = "project.view_all";

    public static final String REPORT_CREATE = "report.create";
    public static final String REPORT_EDIT = "report.edit";
    public static final String REPORT_DELETE_ALL = "report.delete_all";
    public static final String REPORT_SHARE = "report.share";
    public static final String REPORT_SEND_TRACKER = "report.send_tracker";
    public static final String COMMENT_DELETE_ALL = "comment.delete_all";

    /** Role that always keeps every permission and cannot be deleted. */
    public static final String ADMIN_ROLE = "ADMIN";
}

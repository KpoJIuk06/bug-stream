package az.bugtrack.project;

import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.project.ProjectDtos.MemberRole;
import az.bugtrack.project.ProjectDtos.ProjectSummary;
import az.bugtrack.project.ProjectDtos.Visibility;
import az.bugtrack.security.AuthUser;

/**
 * Project access rules in one place.
 *
 *   read            — everyone for PUBLIC projects; PRIVATE: members and project.view_all
 *   manage          — project.manage_all, OWNER, MAINTAINER: settings, services, URL patterns, archive
 *   members         — project.manage_all, OWNER
 */
@Component
public class ProjectAccess {

    private final ProjectRepository projects;

    public ProjectAccess(ProjectRepository projects) {
        this.projects = projects;
    }

    public boolean canRead(AuthUser user, ProjectSummary p) {
        return p.visibility() == Visibility.PUBLIC || user.has(Permissions.PROJECT_VIEW_ALL) || p.myRole() != null;
    }

    public boolean canManage(AuthUser user, UUID projectId) {
        if (user.has(Permissions.PROJECT_MANAGE_ALL)) {
            return true;
        }
        Optional<MemberRole> role = projects.memberRole(projectId, user.id());
        return role.isPresent() && (role.get() == MemberRole.OWNER || role.get() == MemberRole.MAINTAINER);
    }

    public boolean canManageMembers(AuthUser user, UUID projectId) {
        return user.has(Permissions.PROJECT_MANAGE_ALL) || projects.memberRole(projectId, user.id()).orElse(null) == MemberRole.OWNER;
    }

    /** Loads a project checking read access. An inaccessible PRIVATE project looks like a missing one. */
    public ProjectSummary requireReadable(AuthUser user, UUID projectId) {
        ProjectSummary p = projects.findSummary(projectId, user.id())
                .orElseThrow(() -> ApiException.notFound("Project"));
        if (!canRead(user, p)) {
            throw ApiException.notFound("Project");
        }
        return p;
    }

    public void requireManage(AuthUser user, UUID projectId) {
        if (!canManage(user, projectId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
                    "Only project owners, maintainers or admins can do this");
        }
    }

    public void requireManageMembers(AuthUser user, UUID projectId) {
        if (!canManageMembers(user, projectId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN",
                    "Only project owners or admins can manage members");
        }
    }
}

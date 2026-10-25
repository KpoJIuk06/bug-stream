package az.bugtrack.project;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.project.ProjectDtos.HistoryEntry;
import az.bugtrack.project.ProjectDtos.MemberDto;
import az.bugtrack.project.ProjectDtos.MemberRole;
import az.bugtrack.project.ProjectDtos.ProjectDetails;
import az.bugtrack.project.ProjectDtos.ProjectSummary;
import az.bugtrack.project.ProjectDtos.Visibility;
import az.bugtrack.security.AuthUser;
import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;

/** Projects, members and project history. */
@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final ProjectAccess access;
    private final ServiceCatalogService services;
    private final UserRepository users;

    public ProjectService(ProjectRepository projects, ProjectAccess access,
                          ServiceCatalogService services, UserRepository users) {
        this.projects = projects;
        this.access = access;
        this.services = services;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<ProjectSummary> list(AuthUser me, String q, boolean includeArchived) {
        return projects.list(me.id(), me.has(Permissions.PROJECT_VIEW_ALL), q, includeArchived);
    }

    @Transactional(readOnly = true)
    public ProjectDetails get(AuthUser me, UUID id) {
        ProjectSummary p = access.requireReadable(me, id);
        return new ProjectDetails(p, services.listWithPatterns(p.id(), true), access.canManage(me, id),
                projects.networkIgnore(p.id()));
    }

    @Transactional(readOnly = true)
    public ProjectDetails getByKey(AuthUser me, String key) {
        UUID id = projects.findIdByKey(key).orElseThrow(() -> ApiException.notFound("Project"));
        return get(me, id);
    }

    /** Creating a project needs project.create; the creator becomes OWNER. */
    @Transactional
    public ProjectDetails create(AuthUser me, String key, String name, String description, Visibility visibility) {
        if (!me.has(Permissions.PROJECT_CREATE)) {
            throw ApiException.forbidden("Your role cannot create projects");
        }
        if (projects.findIdByKey(key).isPresent()) {
            throw ApiException.conflict("PROJECT_KEY_TAKEN", "Project with key " + key + " already exists");
        }
        UUID id = projects.insert(key, name, description, visibility == null ? Visibility.PUBLIC : visibility, me.id());
        projects.upsertMember(id, me.id(), MemberRole.OWNER, me.id());
        return get(me, id);
    }

    @Transactional
    public ProjectDetails update(AuthUser me, UUID id, String name, String description, Visibility visibility) {
        access.requireReadable(me, id);
        access.requireManage(me, id);
        projects.update(id, name, description, visibility);
        return get(me, id);
    }

    @Transactional
    public ProjectDetails setArchived(AuthUser me, UUID id, boolean archived) {
        access.requireReadable(me, id);
        access.requireManage(me, id);
        projects.setArchived(id, archived);
        return get(me, id);
    }

    /** Project settings: which network requests the extension does not record. */
    @Transactional
    public ProjectDetails updateSettings(AuthUser me, UUID id, List<String> networkIgnore) {
        access.requireReadable(me, id);
        access.requireManage(me, id);
        List<String> cleaned = networkIgnore == null ? List.of()
                : networkIgnore.stream().map(String::trim).filter(x -> !x.isEmpty()).distinct().limit(100).toList();
        projects.setNetworkIgnore(id, cleaned);
        return get(me, id);
    }

    // ----------------------------- members -----------------------------

    @Transactional(readOnly = true)
    public List<MemberDto> members(AuthUser me, UUID projectId) {
        access.requireReadable(me, projectId);
        return projects.members(projectId);
    }

    @Transactional
    public List<MemberDto> setMember(AuthUser me, UUID projectId, UUID userId, MemberRole role) {
        access.requireReadable(me, projectId);
        access.requireManageMembers(me, projectId);
        UserRecord user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (!user.active()) {
            throw ApiException.badRequest("USER_DISABLED", "User is disabled");
        }
        MemberRole current = projects.memberRole(projectId, userId).orElse(null);
        if (current == MemberRole.OWNER && role != MemberRole.OWNER && projects.countOwners(projectId) <= 1) {
            throw ApiException.badRequest("LAST_OWNER", "Project must have at least one owner");
        }
        projects.upsertMember(projectId, userId, role, me.id());
        return projects.members(projectId);
    }

    @Transactional
    public List<MemberDto> removeMember(AuthUser me, UUID projectId, UUID userId) {
        access.requireReadable(me, projectId);
        boolean self = me.id().equals(userId);
        if (!self) {
            access.requireManageMembers(me, projectId);   // anyone may leave a project themselves
        }
        MemberRole current = projects.memberRole(projectId, userId)
                .orElseThrow(() -> ApiException.notFound("Member"));
        if (current == MemberRole.OWNER && projects.countOwners(projectId) <= 1) {
            throw ApiException.badRequest("LAST_OWNER", "Project must have at least one owner");
        }
        projects.removeMember(projectId, userId);
        return projects.members(projectId);
    }

    // ----------------------------- history -----------------------------

    @Transactional(readOnly = true)
    public List<HistoryEntry> history(AuthUser me, UUID projectId, int limit) {
        access.requireReadable(me, projectId);
        return projects.history(projectId, Math.clamp(limit, 1, 500));
    }
}

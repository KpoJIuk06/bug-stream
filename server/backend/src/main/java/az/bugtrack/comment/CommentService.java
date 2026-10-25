package az.bugtrack.comment;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import az.bugtrack.comment.CommentDtos.CommentDto;
import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.eav.AttributeDef;
import az.bugtrack.eav.AttributeRegistry;
import az.bugtrack.eav.EavRepository;
import az.bugtrack.eav.EavRepository.EntityRow;
import az.bugtrack.notification.NotificationService;
import az.bugtrack.project.ProjectAccess;
import az.bugtrack.report.ReportDtos.Ref;
import az.bugtrack.security.AuthUser;
import az.bugtrack.storage.FileDto;
import az.bugtrack.storage.FileRepository;
import az.bugtrack.storage.FileRepository.Kind;
import az.bugtrack.storage.FileStorage;
import az.bugtrack.storage.FileUrlSigner;
import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;

/**
 * Report comments. Anyone signed in may write; only the author may edit and attach files;
 * the author or comment.delete_all may delete.
 */
@Service
public class CommentService {

    private static final String TYPE = "comment";
    private static final DateTimeFormatter MONTH_DIR = DateTimeFormatter.ofPattern("yyyy/MM");

    private final EavRepository eav;
    private final AttributeRegistry attributes;
    private final CommentRepository comments;
    private final FileRepository files;
    private final FileStorage storage;
    private final FileUrlSigner signer;
    private final ProjectAccess access;
    private final UserRepository users;
    private final NotificationService notifications;

    public CommentService(EavRepository eav, AttributeRegistry attributes, CommentRepository comments,
                          FileRepository files, FileStorage storage, FileUrlSigner signer, ProjectAccess access,
                          UserRepository users, NotificationService notifications) {
        this.eav = eav;
        this.attributes = attributes;
        this.comments = comments;
        this.files = files;
        this.storage = storage;
        this.signer = signer;
        this.access = access;
        this.users = users;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<CommentDto> list(AuthUser me, UUID reportId) {
        requireReport(me, reportId);
        var rows = comments.listByReport(reportId);
        Map<UUID, List<FileDto>> attachments = files.listByEntities(rows.stream().map(CommentRepository.CommentRow::id).toList())
                .stream()
                .collect(Collectors.groupingBy(FileRepository.FileRow::entityId,
                        Collectors.mapping(signer::toDto, Collectors.toList())));
        return rows.stream().map(r -> new CommentDto(
                r.id(), r.replyTo(), new Ref(r.authorId(), r.authorName()), r.createdAt(), r.editedAt(), r.body(),
                r.videoTMs(), r.mentionsJson(), attachments.getOrDefault(r.id(), List.of()),
                r.authorId().equals(me.id()))).toList();
    }

    @Transactional
    public List<CommentDto> create(AuthUser me, UUID reportId, String body, UUID replyTo, List<UUID> mentions,
                                   Integer videoTMs) {
        EntityRow report = requireReport(me, reportId);
        if (report.deletedAt() != null) {
            throw ApiException.badRequest("REPORT_DELETED", "Cannot comment on a deleted report");
        }
        if (replyTo != null) {
            EntityRow parent = eav.find(replyTo).filter(e -> TYPE.equals(e.type()) && reportId.equals(e.parentId()))
                    .orElseThrow(() -> ApiException.badRequest("INVALID_REPLY", "Comment to reply to not found"));
            if (parent.deletedAt() != null) {
                throw ApiException.badRequest("INVALID_REPLY", "Comment to reply to was deleted");
            }
        }
        UUID id = eav.createEntity(attributes.entityTypeId(TYPE), reportId, report.projectId(), null, me.id());
        Map<String, AttributeDef> defs = attributes.byCode(TYPE, null);
        eav.setSingle(id, defs.get("body"), body);
        eav.setSingle(id, defs.get("reply_to"), replyTo);
        eav.setSingle(id, defs.get("video_t_ms"), videoTMs == null ? null : videoTMs.longValue());
        List<Object> validMentionIds = validMentions(mentions);
        eav.setMulti(id, defs.get("mentions"), validMentionIds);
        UUID replyToAuthor = replyTo == null ? null : eav.find(replyTo).map(EntityRow::createdBy).orElse(null);
        notifications.commented(reportId, id, body, validMentionIds.stream().map(UUID.class::cast).toList(), replyToAuthor, me);
        return list(me, reportId);
    }

    @Transactional
    public List<CommentDto> update(AuthUser me, UUID commentId, String body, List<UUID> mentions) {
        EntityRow c = requireOwnComment(me, commentId);
        Map<String, AttributeDef> defs = attributes.byCode(TYPE, null);
        eav.setSingle(commentId, defs.get("body"), body);
        eav.setMulti(commentId, defs.get("mentions"), validMentions(mentions));
        eav.setSingle(commentId, defs.get("edited_at"), OffsetDateTime.now());
        eav.touch(commentId);
        return list(me, c.parentId());
    }

    @Transactional
    public List<CommentDto> delete(AuthUser me, UUID commentId) {
        EntityRow c = requireComment(me, commentId);
        if (!me.has(Permissions.COMMENT_DELETE_ALL) && !me.id().equals(c.createdBy())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the author or an admin can delete a comment");
        }
        eav.setDeleted(commentId, true);
        return list(me, c.parentId());
    }

    @Transactional
    public List<CommentDto> addAttachment(AuthUser me, UUID commentId, MultipartFile file) {
        EntityRow c = requireOwnComment(me, commentId);
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "File is empty");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String safe = original.replaceAll("[^A-Za-z0-9._-]", "_");
        if (safe.length() > 100) {
            safe = safe.substring(safe.length() - 100);
        }
        String key = "comments/" + OffsetDateTime.now().format(MONTH_DIR) + "/" + commentId + "/"
                + UUID.randomUUID().toString().substring(0, 8) + "_" + safe;
        String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        try (InputStream in = file.getInputStream()) {
            FileStorage.Saved saved = storage.save(key, in);
            deleteFileOnRollback(key);
            files.insert(commentId, Kind.ATTACHMENT, saved, original, mime, null, me.id());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot store attachment", e);
        }
        return list(me, c.parentId());
    }

    // ------------------------------------------------------------------

    private List<Object> validMentions(List<UUID> mentions) {
        List<Object> result = new ArrayList<>();
        if (mentions == null) {
            return result;
        }
        for (UUID id : mentions) {
            if (id != null && !result.contains(id) && users.findById(id).filter(UserRecord::active).isPresent()) {
                result.add(id);
            }
        }
        return result;
    }

    private EntityRow requireReport(AuthUser me, UUID reportId) {
        EntityRow r = eav.find(reportId).filter(e -> "report".equals(e.type()))
                .orElseThrow(() -> ApiException.notFound("Report"));
        if (r.projectId() != null) {
            access.requireReadable(me, r.projectId());
        }
        return r;
    }

    private EntityRow requireComment(AuthUser me, UUID commentId) {
        EntityRow c = eav.find(commentId).filter(e -> TYPE.equals(e.type()) && e.deletedAt() == null)
                .orElseThrow(() -> ApiException.notFound("Comment"));
        requireReport(me, c.parentId());
        return c;
    }

    private EntityRow requireOwnComment(AuthUser me, UUID commentId) {
        EntityRow c = requireComment(me, commentId);
        if (!me.id().equals(c.createdBy())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the author can edit a comment");
        }
        return c;
    }

    private void deleteFileOnRollback(String key) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    try {
                        java.nio.file.Files.deleteIfExists(storage.resolve(key));
                    } catch (IOException ignored) {
                        // an orphan file is not critical
                    }
                }
            }
        });
    }
}

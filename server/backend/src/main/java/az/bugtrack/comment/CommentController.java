package az.bugtrack.comment;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import az.bugtrack.comment.CommentDtos.CommentDto;
import az.bugtrack.comment.CommentDtos.CreateCommentRequest;
import az.bugtrack.comment.CommentDtos.UpdateCommentRequest;
import az.bugtrack.security.AuthUser;
import jakarta.validation.Valid;

/** Every method returns the current list of the report's comments — the frontend need not reload. */
@RestController
public class CommentController {

    private final CommentService service;

    public CommentController(CommentService service) {
        this.service = service;
    }

    @GetMapping("/api/reports/{reportId}/comments")
    public List<CommentDto> list(@AuthenticationPrincipal AuthUser me, @PathVariable UUID reportId) {
        return service.list(me, reportId);
    }

    @PostMapping("/api/reports/{reportId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public List<CommentDto> create(@AuthenticationPrincipal AuthUser me, @PathVariable UUID reportId,
                                   @Valid @RequestBody CreateCommentRequest req) {
        return service.create(me, reportId, req.body(), req.replyTo(), req.mentions(), req.videoTMs());
    }

    @PatchMapping("/api/comments/{id}")
    public List<CommentDto> update(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                   @Valid @RequestBody UpdateCommentRequest req) {
        return service.update(me, id, req.body(), req.mentions());
    }

    @DeleteMapping("/api/comments/{id}")
    public List<CommentDto> delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.delete(me, id);
    }

    @PostMapping(value = "/api/comments/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<CommentDto> addAttachment(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                          @RequestPart("file") MultipartFile file) {
        return service.addAttachment(me, id, file);
    }
}

package az.bugtrack.comment;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonRawValue;

import az.bugtrack.report.ReportDtos.Ref;
import az.bugtrack.storage.FileDto;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CommentDtos {

    private CommentDtos() {
    }

    public record CommentDto(
            UUID id,
            UUID replyTo,
            Ref author,
            OffsetDateTime createdAt,
            OffsetDateTime editedAt,
            String body,
            Integer videoTMs,                 // comment on a video moment (ms), may be null
            @JsonRawValue String mentions,    // [{"id": "...", "name": "..."}]
            List<FileDto> attachments,
            boolean canEdit) {
    }

    public record CreateCommentRequest(
            @NotBlank @Size(max = 20000) String body,
            UUID replyTo,
            List<UUID> mentions,
            @Min(0) Integer videoTMs) {
    }

    public record UpdateCommentRequest(
            @NotBlank @Size(max = 20000) String body,
            List<UUID> mentions) {
    }
}

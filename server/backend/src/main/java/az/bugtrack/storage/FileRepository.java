package az.bugtrack.storage;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class FileRepository {

    public enum Kind { VIDEO, SCREENSHOT, THUMBNAIL, ATTACHMENT, AVATAR, REPLAY }

    public record FileRow(UUID id, UUID entityId, Kind kind, String storageKey, String fileName, String mimeType,
                          long sizeBytes, Integer durationMs, OffsetDateTime createdAt) {
    }

    private static final String COLUMNS =
            "id, entity_id, kind, storage_key, file_name, mime_type, size_bytes, duration_ms, created_at";

    private final JdbcClient jdbc;

    public FileRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID entityId, Kind kind, FileStorage.Saved saved, String fileName, String mimeType,
                       Integer durationMs, UUID uploadedBy) {
        return jdbc.sql("""
                INSERT INTO stored_file (entity_id, kind, storage_key, file_name, mime_type, size_bytes, sha256,
                                         duration_ms, uploaded_by)
                VALUES (:entityId, :kind, :key, :fileName, :mime, :size, :sha, :duration, :by)
                RETURNING id
                """)
                .param("entityId", entityId)
                .param("kind", kind.name())
                .param("key", saved.key())
                .param("fileName", fileName)
                .param("mime", mimeType)
                .param("size", saved.size())
                .param("sha", saved.sha256())
                .param("duration", durationMs)
                .param("by", uploadedBy)
                .query(UUID.class)
                .single();
    }

    public Optional<FileRow> find(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM stored_file WHERE id = :id")
                .param("id", id)
                .query(FileRepository::map)
                .optional();
    }

    public List<FileRow> listByEntities(Collection<UUID> entityIds) {
        if (entityIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("SELECT " + COLUMNS + " FROM stored_file WHERE entity_id IN (:ids) ORDER BY created_at")
                .param("ids", entityIds)
                .query(FileRepository::map)
                .list();
    }

    private static FileRow map(ResultSet rs, int row) throws SQLException {
        return new FileRow(
                rs.getObject("id", UUID.class),
                rs.getObject("entity_id", UUID.class),
                Kind.valueOf(rs.getString("kind")),
                rs.getString("storage_key"),
                rs.getString("file_name"),
                rs.getString("mime_type"),
                rs.getLong("size_bytes"),
                (Integer) rs.getObject("duration_ms"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}

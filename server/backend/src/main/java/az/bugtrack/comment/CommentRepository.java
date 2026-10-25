package az.bugtrack.comment;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads a report's comments in one query (EAV is unpacked by PostgreSQL). */
@Repository
public class CommentRepository {

    public record CommentRow(UUID id, UUID authorId, String authorName, OffsetDateTime createdAt,
                             OffsetDateTime editedAt, String body, UUID replyTo, Integer videoTMs,
                             String mentionsJson) {
    }

    private final JdbcClient jdbc;

    public CommentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<CommentRow> listByReport(UUID reportId) {
        return jdbc.sql("""
                SELECT e.id, e.created_by, u.full_name, e.created_at,
                       f.body, f.reply_to, f.video_t_ms, f.edited_at,
                       coalesce((SELECT jsonb_agg(jsonb_build_object('id', mu.id, 'name', mu.full_name) ORDER BY mv.idx)
                                   FROM entity_value mv
                                   JOIN attribute ma ON ma.id = mv.attribute_id AND ma.code = 'mentions'
                                   JOIN app_user mu ON mu.id = mv.v_uuid
                                  WHERE mv.entity_id = e.id), '[]'::jsonb)::text AS mentions
                  FROM entity e
                  JOIN entity_type t ON t.id = e.entity_type_id AND t.code = 'comment'
                  JOIN app_user u ON u.id = e.created_by
                  LEFT JOIN LATERAL (
                       SELECT max(v.v_text) FILTER (WHERE a.code = 'body')                 AS body,
                              (array_agg(v.v_uuid) FILTER (WHERE a.code = 'reply_to'))[1] AS reply_to,
                              max(v.v_int) FILTER (WHERE a.code = 'video_t_ms')            AS video_t_ms,
                              max(v.v_ts) FILTER (WHERE a.code = 'edited_at')              AS edited_at
                         FROM entity_value v
                         JOIN attribute a ON a.id = v.attribute_id
                        WHERE v.entity_id = e.id) f ON true
                 WHERE e.parent_id = :rid AND e.deleted_at IS NULL
                 ORDER BY e.id
                """)
                .param("rid", reportId)
                .query((rs, n) -> {
                    Object t = rs.getObject("video_t_ms");
                    return new CommentRow(
                            rs.getObject("id", UUID.class),
                            rs.getObject("created_by", UUID.class),
                            rs.getString("full_name"),
                            rs.getObject("created_at", OffsetDateTime.class),
                            rs.getObject("edited_at", OffsetDateTime.class),
                            rs.getString("body"),
                            rs.getObject("reply_to", UUID.class),
                            t == null ? null : ((Number) t).intValue(),
                            rs.getString("mentions"));
                })
                .list();
    }
}

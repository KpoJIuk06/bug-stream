package az.bugtrack.eav;

import java.util.List;
import java.util.UUID;

/** EAV field definition (a row of attribute). projectId != null: a custom field of a project. */
public record AttributeDef(
        UUID id,
        String entityType,
        UUID projectId,
        String code,
        String label,
        DataType dataType,
        boolean required,
        boolean multi,
        boolean filterable,
        boolean system,
        List<String> options,
        int sortOrder) {

    public enum DataType { STRING, TEXT, INT, DECIMAL, BOOL, TIMESTAMP, UUID, JSON }

    /** The entity_value column that stores values of this type. */
    public String column() {
        return switch (dataType) {
            case STRING -> "v_string";
            case TEXT -> "v_text";
            case INT -> "v_int";
            case DECIMAL -> "v_decimal";
            case BOOL -> "v_bool";
            case TIMESTAMP -> "v_ts";
            case UUID -> "v_uuid";
            case JSON -> "v_json";
        };
    }
}

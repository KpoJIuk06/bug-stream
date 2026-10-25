package az.bugtrack.eav;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import az.bugtrack.common.ApiException;

/**
 * Converts a JSON request value (String / Number / Boolean / List) to the Java type of the entity_value column.
 * Errors: 400 with code INVALID_FIELD.
 */
public final class ValueConverter {

    private static final int MAX_STRING = 2048;

    private ValueConverter() {
    }

    /** A single value. null or an empty string → null (the field is cleared). */
    public static Object convert(AttributeDef a, Object raw) {
        if (raw == null || (raw instanceof String s && s.isBlank())) {
            return null;
        }
        try {
            Object value = switch (a.dataType()) {
                case STRING -> {
                    String s = String.valueOf(raw).trim();
                    if (s.length() > MAX_STRING) {
                        throw invalid(a, "is longer than " + MAX_STRING + " characters");
                    }
                    yield s;
                }
                case TEXT -> String.valueOf(raw);
                case INT -> raw instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(raw).trim());
                case DECIMAL -> raw instanceof Number n ? new BigDecimal(n.toString())
                        : new BigDecimal(String.valueOf(raw).trim());
                case BOOL -> raw instanceof Boolean b ? b : parseBool(a, String.valueOf(raw));
                case TIMESTAMP -> raw instanceof Number n
                        ? OffsetDateTime.ofInstant(Instant.ofEpochMilli(n.longValue()), ZoneOffset.UTC)
                        : OffsetDateTime.parse(String.valueOf(raw).trim());
                case UUID -> UUID.fromString(String.valueOf(raw).trim());
                case JSON -> throw invalid(a, "JSON fields cannot be set through this API");
            };
            if (a.options() != null && value instanceof String s && !a.options().contains(s)) {
                throw invalid(a, "must be one of " + a.options());
            }
            return value;
        } catch (NumberFormatException | DateTimeParseException e) {
            throw invalid(a, "has invalid format for type " + a.dataType());
        } catch (IllegalArgumentException e) {   // UUID.fromString
            throw invalid(a, "has invalid format for type " + a.dataType());
        }
    }

    /** Values for an is_multi field: a list or a single value; empty values and duplicates are dropped. */
    public static List<Object> convertList(AttributeDef a, Object raw) {
        List<Object> result = new ArrayList<>();
        if (raw == null) {
            return result;
        }
        Collection<?> items = raw instanceof Collection<?> c ? c : List.of(raw);
        for (Object item : items) {
            Object v = convert(a, item);
            if (v != null && !result.contains(v)) {
                result.add(v);
            }
        }
        return result;
    }

    private static Boolean parseBool(AttributeDef a, String s) {
        return switch (s.trim().toLowerCase()) {
            case "true", "1", "yes" -> true;
            case "false", "0", "no" -> false;
            default -> throw invalid(a, "must be true or false");
        };
    }

    private static ApiException invalid(AttributeDef a, String message) {
        return ApiException.badRequest("INVALID_FIELD", "Field '" + a.code() + "' " + message);
    }
}

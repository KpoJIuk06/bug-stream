package az.bugtrack.storage;

import java.util.UUID;

/** File for the frontend; url is a signed link that can go straight into <video src> / <img src>. */
public record FileDto(UUID id, String kind, String fileName, String mimeType, long sizeBytes, Integer durationMs,
                      String url) {
}

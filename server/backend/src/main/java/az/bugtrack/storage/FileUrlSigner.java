package az.bugtrack.storage;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

import az.bugtrack.config.AppProperties;
import az.bugtrack.storage.FileRepository.FileRow;

/**
 * Signed file links: /api/files/{id}?exp=...&sig=...
 * Needed because <video src> and <img src> cannot send the Authorization header.
 * A link lives until the end of the next day (exp is rounded to a day so browsers can cache previews).
 */
@Component
public class FileUrlSigner {

    private static final long DAY = 86_400;

    private final byte[] key;

    public FileUrlSigner(AppProperties props) {
        this.key = ("files:" + props.jwt().secret()).getBytes(StandardCharsets.UTF_8);
    }

    public String url(UUID fileId) {
        long exp = (Instant.now().getEpochSecond() / DAY + 2) * DAY;
        return "/api/files/" + fileId + "?exp=" + exp + "&sig=" + sign(fileId, exp);
    }

    public FileDto toDto(FileRow f) {
        return new FileDto(f.id(), f.kind().name(), f.fileName(), f.mimeType(), f.sizeBytes(), f.durationMs(),
                url(f.id()));
    }

    public boolean verify(UUID fileId, long exp, String sig) {
        if (sig == null || exp < Instant.now().getEpochSecond()) {
            return false;
        }
        return MessageDigest.isEqual(sign(fileId, exp).getBytes(StandardCharsets.US_ASCII),
                sig.getBytes(StandardCharsets.US_ASCII));
    }

    private String sign(UUID fileId, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] h = mac.doFinal((fileId + ":" + exp).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(h);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}

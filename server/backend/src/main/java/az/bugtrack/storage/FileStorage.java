package az.bugtrack.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import az.bugtrack.config.AppProperties;

/**
 * Files on disk (docker volume ./storage). The database (stored_file) keeps only the relative path — key.
 * Example key: reports/2026/10/<reportId>/video.webm
 */
@Component
public class FileStorage {

    private static final Logger log = LoggerFactory.getLogger(FileStorage.class);

    public record Saved(String key, long size, String sha256) {
    }

    private final Path root;

    public FileStorage(AppProperties props) {
        this.root = Path.of(props.storage().root()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create storage root " + root, e);
        }
    }

    public Saved save(String key, InputStream in) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        MessageDigest md = sha256();
        long size;
        try (DigestInputStream din = new DigestInputStream(in, md)) {
            size = Files.copy(din, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return new Saved(key, size, HexFormat.of().formatHex(md.digest()));
    }

    /** Absolute path for a key; prevents escaping the storage root ("../"). */
    public Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key: " + key);
        }
        return p;
    }

    /** Deletes a whole folder (used when a report upload rolls back). */
    public void deleteDirQuietly(String dirKey) {
        Path dir = resolve(dirKey);
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    log.warn("Cannot delete {}", p, e);
                }
            });
        } catch (IOException e) {
            log.warn("Cannot clean up {}", dir, e);
        }
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

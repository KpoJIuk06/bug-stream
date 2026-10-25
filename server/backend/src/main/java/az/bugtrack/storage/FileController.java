package az.bugtrack.storage;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.common.ApiException;

/**
 * Serves files by signed URL. The Range header is supported automatically
 * (Spring answers 206 Partial Content for a Resource) — videos can be seeked.
 */
@RestController
public class FileController {

    private final FileRepository files;
    private final FileStorage storage;
    private final FileUrlSigner signer;

    public FileController(FileRepository files, FileStorage storage, FileUrlSigner signer) {
        this.files = files;
        this.storage = storage;
        this.signer = signer;
    }

    @GetMapping("/api/files/{id}")
    public ResponseEntity<Resource> get(@PathVariable UUID id,
                                        @RequestParam long exp,
                                        @RequestParam String sig,
                                        @RequestParam(defaultValue = "false") boolean download) {
        if (!signer.verify(id, exp, sig)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "BAD_SIGNATURE", "Link is invalid or expired");
        }
        FileRepository.FileRow row = files.find(id).orElseThrow(() -> ApiException.notFound("File"));
        Path path = storage.resolve(row.storageKey());
        if (!Files.isRegularFile(path)) {
            throw ApiException.notFound("File");
        }
        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(row.fileName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(row.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                .body(new FileSystemResource(path));
    }
}

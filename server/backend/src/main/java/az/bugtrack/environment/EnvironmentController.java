package az.bugtrack.environment;

import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.common.ApiException;
import az.bugtrack.environment.EnvironmentRepository.EnvironmentDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Environments (DEV, TEST, STAGE, PROD, ...). Everyone signed in reads the list (pickers on the site
 * and in the extension); admins with environment.manage add, rename, recolor, hide or delete them.
 * An environment that is already used by services or reports can only be hidden (inactive), not deleted.
 */
@RestController
public class EnvironmentController {

    public record EnvironmentRequest(
            @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]{0,19}$") String code,
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String color,
            @NotNull Integer sortOrder,
            Boolean active) {
    }

    private final EnvironmentRepository repo;

    public EnvironmentController(EnvironmentRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/api/environments")
    public List<EnvironmentDto> list(@RequestParam(defaultValue = "false") boolean all) {
        return repo.list(all);
    }

    @PostMapping("/api/admin/environments")
    @PreAuthorize("hasAuthority('environment.manage')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public EnvironmentDto create(@Valid @RequestBody EnvironmentRequest req) {
        if (req.code() == null) {
            throw ApiException.badRequest("CODE_REQUIRED", "Environment code is required");
        }
        String code = req.code().toUpperCase(Locale.ROOT);
        if (repo.exists(code)) {
            throw ApiException.conflict("ENVIRONMENT_EXISTS", "Environment " + code + " already exists");
        }
        repo.insert(code, req.name().trim(), req.color(), req.sortOrder());
        return repo.findByCode(code).orElseThrow();
    }

    @PatchMapping("/api/admin/environments/{code}")
    @PreAuthorize("hasAuthority('environment.manage')")
    @Transactional
    public EnvironmentDto update(@PathVariable String code, @Valid @RequestBody EnvironmentRequest req) {
        EnvironmentDto current = repo.findByCode(code).orElseThrow(() -> ApiException.notFound("Environment"));
        boolean active = req.active() == null ? current.active() : req.active();
        if (!active && current.active() && repo.list(false).size() <= 1) {
            throw ApiException.badRequest("LAST_ENVIRONMENT", "At least one environment must stay active");
        }
        repo.update(code, req.name().trim(), req.color(), req.sortOrder(), active);
        return repo.findByCode(code).orElseThrow();
    }

    @DeleteMapping("/api/admin/environments/{code}")
    @PreAuthorize("hasAuthority('environment.manage')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable String code) {
        EnvironmentDto current = repo.findByCode(code).orElseThrow(() -> ApiException.notFound("Environment"));
        if (current.servicesCount() > 0 || current.reportsCount() > 0) {
            throw ApiException.conflict("ENVIRONMENT_IN_USE",
                    "The environment is used by services or reports — make it inactive instead");
        }
        if (current.active() && repo.list(false).size() <= 1) {
            throw ApiException.badRequest("LAST_ENVIRONMENT", "At least one environment must stay active");
        }
        repo.delete(code);
        return ResponseEntity.noContent().build();
    }
}

package az.bugtrack.settings;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Settings every signed-in user needs (e.g. whether "Open by link" is available). */
@RestController
public class SettingsController {

    public record PublicSettings(boolean sharingEnabled, int sharingDefaultDays, int sharingMaxDays) {
    }

    private final SettingsService settings;

    public SettingsController(SettingsService settings) {
        this.settings = settings;
    }

    @GetMapping("/api/settings")
    public PublicSettings get() {
        Map<String, Object> all = settings.all();
        return new PublicSettings(
                Boolean.TRUE.equals(all.get(SettingsService.SHARING_ENABLED)),
                ((Number) all.get(SettingsService.SHARING_DEFAULT_DAYS)).intValue(),
                ((Number) all.get(SettingsService.SHARING_MAX_DAYS)).intValue());
    }
}

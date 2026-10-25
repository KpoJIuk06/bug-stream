package az.bugtrack.config;

import org.flywaydb.core.api.CoreErrorCode;
import org.flywaydb.core.api.output.ValidateOutput;
import org.flywaydb.core.api.output.ValidateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Migrations V1–V9 were first released with Russian comments; the comments were later translated to English.
 * Flyway checksums cover comments too, so on databases created before the translation the checksums of
 * V1–V9 differ although the SQL is the same. Only in that exact case the stored checksums are updated
 * (flyway repair) before migrating. Any other validation problem stops the start as usual.
 */
@Configuration
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);
    private static final int LAST_TRANSLATED_VERSION = 9;

    @Bean
    public FlywayMigrationStrategy migrationStrategy() {
        return flyway -> {
            ValidateResult result = flyway.validateWithResult();
            if (!result.validationSuccessful && onlyTranslatedChecksums(result)) {
                log.warn("Updating checksums of migrations V1–V{} (comments translated to English, SQL unchanged)",
                        LAST_TRANSLATED_VERSION);
                flyway.repair();
            }
            flyway.migrate();
        };
    }

    private static boolean onlyTranslatedChecksums(ValidateResult result) {
        boolean anyChecksum = false;
        for (ValidateOutput m : result.invalidMigrations) {
            if (m.errorDetails == null) {
                return false;
            }
            if (m.errorDetails.errorCode == CoreErrorCode.RESOLVED_VERSIONED_MIGRATION_NOT_APPLIED) {
                continue;   // a new migration waiting to be applied — normal
            }
            if (m.errorDetails.errorCode != CoreErrorCode.CHECKSUM_MISMATCH || !isTranslated(m.version)) {
                return false;
            }
            anyChecksum = true;
        }
        return anyChecksum;
    }

    private static boolean isTranslated(String version) {
        try {
            return version != null && Integer.parseInt(version) <= LAST_TRANSLATED_VERSION;
        } catch (NumberFormatException e) {
            return false;
        }
    }

}

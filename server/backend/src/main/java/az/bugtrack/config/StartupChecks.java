package az.bugtrack.config;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Refuses to run a real installation with the placeholder secrets from .env.example
 * ("change_me…"). On localhost it only warns, so a quick local try still works.
 * Generate real values with server/scripts/init-env.sh (or init-env.ps1).
 */
@Component
public class StartupChecks {

    private static final Logger log = LoggerFactory.getLogger(StartupChecks.class);

    private final AppProperties props;

    public StartupChecks(AppProperties props) {
        this.props = props;
    }

    @EventListener(ApplicationStartedEvent.class)
    public void check() {
        List<String> weak = new ArrayList<>();
        if (placeholder(props.jwt() == null ? null : props.jwt().secret())) weak.add("JWT_SECRET");
        if (props.bootstrapAdmin() != null && placeholder(props.bootstrapAdmin().password())) weak.add("ADMIN_PASSWORD");
        if (placeholder(System.getenv("DB_PASSWORD"))) weak.add("POSTGRES_PASSWORD");
        if (weak.isEmpty()) return;

        String msg = "Placeholder values from .env.example are still used: " + String.join(", ", weak)
                + ". Run server/scripts/init-env.sh (or init-env.ps1) or set real values in .env.";
        if (local()) {
            log.warn("{} OK for a local try on {}, NOT for a real installation.", msg, props.publicUrl());
        } else {
            throw new IllegalStateException(msg);
        }
    }

    private boolean local() {
        try {
            String host = URI.create(props.publicUrl() == null ? "" : props.publicUrl().trim()).getHost();
            return host == null || host.equals("localhost") || host.equals("127.0.0.1") || host.endsWith(".localhost");
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean placeholder(String value) {
        return value != null && value.toLowerCase().startsWith("change_me");
    }
}

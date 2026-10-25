package az.bugtrack.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import az.bugtrack.access.Permissions;
import az.bugtrack.config.AppProperties;

/**
 * On the first start (no users in the database) creates a local administrator
 * from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final UserService userService;
    private final AppProperties props;

    public AdminBootstrap(UserRepository users, UserService userService, AppProperties props) {
        this.users = users;
        this.userService = userService;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        var admin = props.bootstrapAdmin();
        if (admin == null || isBlank(admin.email()) || isBlank(admin.password())) {
            log.warn("No users in database and ADMIN_EMAIL / ADMIN_PASSWORD are not set — nobody can log in");
            return;
        }
        String name = isBlank(admin.fullName()) ? "Administrator" : admin.fullName();
        userService.create(admin.email(), admin.password(), name, Permissions.ADMIN_ROLE, UserRecord.LOCAL, null, false);
        log.info("Created initial administrator {}", admin.email());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}

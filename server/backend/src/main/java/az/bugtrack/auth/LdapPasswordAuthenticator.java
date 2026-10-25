package az.bugtrack.auth;

import java.util.Optional;
import java.util.UUID;

import javax.naming.NamingException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import az.bugtrack.access.RoleRepository;
import az.bugtrack.auth.LdapAuthenticator.LdapUser;
import az.bugtrack.common.ApiException;
import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;

/**
 * Active Directory / LDAP: the password is checked by the directory; the local account is created
 * on the first successful sign-in and updated (name, login, role from groups) on every next one.
 */
@Component
@Order(2)
class LdapPasswordAuthenticator implements PasswordAuthenticator {

    private static final Logger log = LoggerFactory.getLogger(LdapPasswordAuthenticator.class);

    private final LdapAuthenticator ldap;
    private final UserRepository users;
    private final RoleRepository roles;

    LdapPasswordAuthenticator(LdapAuthenticator ldap, UserRepository users, RoleRepository roles) {
        this.ldap = ldap;
        this.users = users;
        this.roles = roles;
    }

    @Override
    public String method() {
        return "LDAP";
    }

    @Override
    public Optional<UserRecord> authenticate(String login, String password) {
        Optional<LdapUser> found;
        try {
            found = ldap.authenticate(login, password);
        } catch (NamingException e) {
            log.error("LDAP sign-in failed: {}", LdapAuthenticator.describe(e));
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "LDAP_UNAVAILABLE",
                    "The corporate directory is not available, try again later");
        }
        if (found.isEmpty()) {
            return Optional.empty();
        }
        LdapUser lu = found.get();
        String groupRole = ldap.roleFromGroups(lu.groups());
        if (groupRole != null && roles.findByCode(groupRole).isEmpty()) {
            log.warn("LDAP group mapping points to unknown role {} — ignored", groupRole);
            groupRole = null;
        }
        if (ldap.rolesFromGroups() && groupRole == null) {
            // group mapping is configured and the user is in none of the groups: no access
            log.info("LDAP user {} is not in any mapped group", lu.email());
            throw ApiException.unauthorized("NO_ACCESS", "You are not in a group that has access to Bug Stream");
        }
        Optional<UserRecord> existing = users.findByEmail(lu.email());
        UUID id;
        if (existing.isPresent()) {
            id = existing.get().id();
            users.syncLdap(id, lu.fullName(), lu.username(), lu.dn(), groupRole);
        } else {
            String role = groupRole != null ? groupRole : ldap.defaultRole();
            if (roles.findByCode(role).isEmpty()) {
                role = "VIEWER";
            }
            id = users.insert(lu.email(), null, lu.fullName(), role, UserRecord.LDAP, lu.username(), lu.dn());
            log.info("Created LDAP user {} with role {}", lu.email(), role);
        }
        return users.findById(id);
    }
}

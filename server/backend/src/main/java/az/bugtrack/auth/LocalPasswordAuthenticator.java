package az.bugtrack.auth;

import java.util.Optional;

import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;

/** Local accounts: bcrypt hash in app_user.password_hash; login by e-mail or username. */
@Component
@Order(1)
class LocalPasswordAuthenticator implements PasswordAuthenticator {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    LocalPasswordAuthenticator(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public String method() {
        return "PASSWORD";
    }

    @Override
    public Optional<UserRecord> authenticate(String login, String password) {
        return users.findByEmail(login).or(() -> users.findByUsername(login))
                .filter(u -> u.isLocal() && u.passwordHash() != null)
                .filter(u -> passwordEncoder.matches(password, u.passwordHash()));
    }
}

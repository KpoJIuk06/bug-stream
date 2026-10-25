package az.bugtrack.auth;

import java.util.Optional;

import az.bugtrack.user.UserRecord;

/**
 * A sign-in method that checks a login + password (local accounts, AD / LDAP, …).
 * AuthService asks the enabled ones in order; the first that recognizes the login and password wins.
 * Methods that do not use a password (e-mail code, future SSO) have their own endpoints.
 */
interface PasswordAuthenticator {

    /** Settings name of the method: PASSWORD, LDAP. */
    String method();

    /**
     * @return the user when the login and password are valid; empty when this method does not know the login
     *         or the password is wrong
     * @throws az.bugtrack.common.ApiException for a definite refusal (directory unavailable, no access group)
     */
    Optional<UserRecord> authenticate(String login, String password);
}

package az.bugtrack.auth;

import com.fasterxml.jackson.annotation.JsonAlias;

import az.bugtrack.user.UserDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    /** login: e-mail, or the corporate login (sAMAccountName / UPN) when LDAP is on. Old clients send "email". */
    public record LoginRequest(
            @NotBlank @Size(max = 320) @JsonAlias("email") String login,
            @NotBlank @Size(max = 256) String password,
            @NotNull ClientType client) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    /** currentPassword may be empty only for an account that has no password yet (created by an e-mail code). */
    public record ChangePasswordRequest(
            String currentPassword,
            @NotBlank @Size(min = 8, max = 128) String newPassword) {
    }

    public record LocaleRequest(@NotBlank String locale) {
    }

    /** Response of login and refresh. expiresIn: access token lifetime in seconds. */
    public record TokenResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            UserDto user) {
    }

    /**
     * What the sign-in page needs to know before the user signs in: the available methods.
     * ldapEnabled is kept for extension 0.3 / 0.4.
     */
    public record AuthConfig(boolean password, boolean passwordReset, boolean ldap, boolean emailCode,
                             boolean ldapEnabled) {
    }

    /** locale: language of the e-mail for an address that has no account yet. */
    public record EmailRequest(@NotBlank @Size(max = 320) String email, String locale) {
    }

    public record EmailCodeVerifyRequest(
            @NotBlank @Size(max = 320) String email,
            @NotBlank @Size(max = 20) String code,
            @NotNull ClientType client) {
    }

    public record SetPasswordRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Size(min = 8, max = 128) String newPassword,
            ClientType client) {
    }
}

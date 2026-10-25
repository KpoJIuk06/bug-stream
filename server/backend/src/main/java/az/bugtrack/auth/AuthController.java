package az.bugtrack.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.auth.AuthDtos.AuthConfig;
import az.bugtrack.auth.AuthDtos.ChangePasswordRequest;
import az.bugtrack.auth.AuthDtos.EmailCodeVerifyRequest;
import az.bugtrack.auth.AuthDtos.EmailRequest;
import az.bugtrack.auth.AuthDtos.LocaleRequest;
import az.bugtrack.auth.AuthDtos.LoginRequest;
import az.bugtrack.auth.AuthDtos.RefreshRequest;
import az.bugtrack.auth.AuthDtos.SetPasswordRequest;
import az.bugtrack.auth.AuthDtos.TokenResponse;
import az.bugtrack.security.AuthUser;
import az.bugtrack.user.UserDto;
import az.bugtrack.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final UserService users;
    private final AuthMethods methods;
    private final AuthCodeService codes;

    public AuthController(AuthService auth, UserService users, AuthMethods methods, AuthCodeService codes) {
        this.auth = auth;
        this.users = users;
        this.methods = methods;
        this.codes = codes;
    }

    /** Public: which sign-in methods the sign-in page and the extension should offer. */
    @GetMapping("/config")
    public AuthConfig config() {
        AuthMethods.Effective e = methods.effective();
        return new AuthConfig(e.password(), e.passwordReset(), e.ldap(), e.emailCode(), e.ldap());
    }

    /** "Sign in with an e-mail code", step 1. Always 204 — does not reveal whether the address is known. */
    @PostMapping("/email-code")
    public ResponseEntity<Void> requestCode(@Valid @RequestBody EmailRequest req, HttpServletRequest http) {
        codes.requestLoginCode(req.email(), req.locale(), clientIp(http));
        return ResponseEntity.noContent().build();
    }

    /** Step 2: the code from the e-mail → tokens. */
    @PostMapping("/email-code/verify")
    public TokenResponse verifyCode(@Valid @RequestBody EmailCodeVerifyRequest req,
                                    @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
        return auth.loginWithCode(req.email(), req.code(), req.client(), ua);
    }

    /** "Forgot password?". Always 204. */
    @PostMapping("/password/forgot")
    public ResponseEntity<Void> forgot(@Valid @RequestBody EmailRequest req, HttpServletRequest http) {
        codes.requestPasswordReset(req.email(), req.locale(), clientIp(http));
        return ResponseEntity.noContent().build();
    }

    /** What the "set password" page shows (reset or invitation). */
    @GetMapping("/password/link")
    public AuthCodeService.LinkInfo link(@RequestParam String token) {
        return codes.linkInfo(token);
    }

    /** Sets the password from the link and signs the user in. */
    @PostMapping("/password/reset")
    public TokenResponse setPassword(@Valid @RequestBody SetPasswordRequest req,
                                     @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
        return auth.completePassword(req.token(), req.newPassword(),
                req.client() == null ? ClientType.WEB : req.client(), ua);
    }

    /** nginx sets X-Real-IP; without nginx (development) — the socket address. */
    private static String clientIp(HttpServletRequest http) {
        String ip = http.getHeader("X-Real-IP");
        return ip != null && !ip.isBlank() ? ip.trim() : http.getRemoteAddr();
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req,
                               @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
        return auth.login(req.login(), req.password(), req.client(), ua);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest req,
                                 @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
        return auth.refresh(req.refreshToken(), ua);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest req) {
        auth.logout(req.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal AuthUser me) {
        return auth.me(me.id());
    }

    /** Interface language of the signed-in user: en | ru | az. */
    @PutMapping("/me/locale")
    public UserDto setLocale(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody LocaleRequest req) {
        users.setLocale(me.id(), req.locale());
        return auth.me(me.id());
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthUser me,
                                               @Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(me.id(), req.currentPassword(), req.newPassword());
        return ResponseEntity.noContent().build();
    }
}

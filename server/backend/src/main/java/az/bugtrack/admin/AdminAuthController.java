package az.bugtrack.admin;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.auth.AuthMethods;
import az.bugtrack.auth.LdapAuthenticator;
import az.bugtrack.auth.LdapAuthenticator.TestResult;
import az.bugtrack.auth.LdapConfigService;
import az.bugtrack.auth.LdapConfigService.LdapRequest;
import az.bugtrack.auth.LdapConfigService.LdapStatus;
import az.bugtrack.common.ApiException;
import az.bugtrack.mail.MailLayout;
import az.bugtrack.mail.MailService;
import az.bugtrack.mail.MailService.MailRequest;
import az.bugtrack.mail.MailService.MailStatus;
import az.bugtrack.security.AuthUser;

/**
 * Administration → Sign-in (which methods are on, AD / LDAP connection) and Administration → E-mail (SMTP).
 * Reading needs admin.access, changing needs settings.manage.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminAuthController {

    public record LdapTestRequest(String login, LdapRequest config) {
    }

    public record MailTestRequest(String to) {
    }

    public record MailTestResult(boolean ok, String message) {
    }

    private final AuthMethods methods;
    private final MailService mail;
    private final LdapConfigService ldapConfig;
    private final LdapAuthenticator ldap;

    public AdminAuthController(AuthMethods methods, MailService mail, LdapConfigService ldapConfig, LdapAuthenticator ldap) {
        this.methods = methods;
        this.mail = mail;
        this.ldapConfig = ldapConfig;
        this.ldap = ldap;
    }

    // ----------------------------- sign-in methods -----------------------------

    @GetMapping("/auth")
    public AuthMethods.AdminView auth() {
        return methods.adminView();
    }

    @PutMapping("/auth")
    @PreAuthorize("hasAuthority('settings.manage')")
    public AuthMethods.AdminView updateAuth(@AuthenticationPrincipal AuthUser me, @RequestBody Map<String, Object> changes) {
        return methods.update(changes, me.id());
    }

    // ----------------------------- LDAP -----------------------------

    @GetMapping("/ldap")
    public LdapStatus ldap() {
        return ldapConfig.status();
    }

    @PutMapping("/ldap")
    @PreAuthorize("hasAuthority('settings.manage')")
    public LdapStatus saveLdap(@AuthenticationPrincipal AuthUser me, @RequestBody LdapRequest req) {
        return ldapConfig.save(req, me.id());
    }

    @DeleteMapping("/ldap")
    @PreAuthorize("hasAuthority('settings.manage')")
    public LdapStatus resetLdap() {
        return ldapConfig.reset();
    }

    /**
     * Checks the service account; with a login also shows what the directory returns for that user.
     * With "config" the form values are tested before saving (an empty password = the saved one).
     */
    @PostMapping("/ldap/test")
    @PreAuthorize("hasAuthority('settings.manage') or hasAuthority('user.manage')")
    public TestResult testLdap(@RequestBody LdapTestRequest req) {
        return req.config() == null ? ldap.test(req.login()) : ldap.test(ldapConfig.candidate(req.config()), req.login());
    }

    // ----------------------------- SMTP -----------------------------

    @GetMapping("/mail")
    public MailStatus mail() {
        return mail.status();
    }

    @PutMapping("/mail")
    @PreAuthorize("hasAuthority('settings.manage')")
    public MailStatus saveMail(@AuthenticationPrincipal AuthUser me, @RequestBody MailRequest req) {
        return mail.save(req, me.id());
    }

    @DeleteMapping("/mail")
    @PreAuthorize("hasAuthority('settings.manage')")
    public MailStatus resetMail() {
        return mail.reset();
    }

    /** Sends a test e-mail with the saved settings (to the admin by default). */
    @PostMapping("/mail/test")
    @PreAuthorize("hasAuthority('settings.manage')")
    public MailTestResult testMail(@AuthenticationPrincipal AuthUser me, @RequestBody(required = false) MailTestRequest req) {
        String to = req == null || req.to() == null || req.to().isBlank() ? me.email() : req.to().trim();
        if (!to.matches("[^@\\s]+@[^@\\s]+")) {
            throw ApiException.badRequest("INVALID_EMAIL", "Enter a valid e-mail address");
        }
        try {
            String text = "This is a test e-mail from Bug Stream. If you can read it, the SMTP settings work.";
            mail.send(to, "Bug Stream: test e-mail", text,
                    MailLayout.html("Test e-mail", MailLayout.p(text), null, null, "Sent from Administration → E-mail."));
            return new MailTestResult(true, "Sent to " + to);
        } catch (MailService.MailFailure e) {
            return new MailTestResult(false, e.getMessage());
        } catch (ApiException e) {
            if (e.status() == HttpStatus.CONFLICT) {
                return new MailTestResult(false, e.getMessage());
            }
            throw e;
        }
    }
}

package az.bugtrack.auth;

import java.util.Map;

import az.bugtrack.mail.MailLayout;

/** Sign-in e-mails in the recipient's language (en / ru / az). */
final class AuthMails {

    record Mail(String subject, String text, String html) {
    }

    private AuthMails() {
    }

    private static final Map<String, String[]> CODE = Map.of(
            "en", new String[] {"Your Bug Stream sign-in code: %s", "Your sign-in code",
                    "Enter this code on the sign-in page. It is valid for %d minutes and can be used once.",
                    "If you did not try to sign in, just ignore this e-mail."},
            "ru", new String[] {"Код входа в Bug Stream: %s", "Ваш код для входа",
                    "Введите этот код на странице входа. Он действует %d минут и только один раз.",
                    "Если вы не пытались войти, просто проигнорируйте это письмо."},
            "az", new String[] {"Bug Stream giriş kodu: %s", "Giriş kodunuz",
                    "Bu kodu giriş səhifəsində daxil edin. Kod %d dəqiqə etibarlıdır və bir dəfə istifadə olunur.",
                    "Əgər daxil olmağa cəhd etməmisinizsə, bu məktubu nəzərə almayın."});

    private static final Map<String, String[]> RESET = Map.of(
            "en", new String[] {"Bug Stream: reset your password", "Reset your password",
                    "Someone (hopefully you) asked to reset the password for %s. The link is valid for %d minutes.",
                    "Set a new password", "If you did not ask for this, ignore this e-mail — your password stays the same."},
            "ru", new String[] {"Bug Stream: сброс пароля", "Сброс пароля",
                    "Кто-то (надеемся, вы) запросил сброс пароля для %s. Ссылка действует %d минут.",
                    "Задать новый пароль", "Если вы этого не делали, проигнорируйте письмо — пароль не изменится."},
            "az", new String[] {"Bug Stream: parolun bərpası", "Parolun bərpası",
                    "Kimsə (ümid edirik ki, siz) %s üçün parolun bərpasını istəyib. Link %d dəqiqə etibarlıdır.",
                    "Yeni parol təyin et", "Əgər bunu siz etməmisinizsə, məktubu nəzərə almayın — parolunuz dəyişməyəcək."});

    private static final Map<String, String[]> INVITE = Map.of(
            "en", new String[] {"You are invited to Bug Stream", "Welcome to Bug Stream, %s",
                    "An account has been created for you (%s). Set your password to sign in. The link is valid for %d days.",
                    "Set password", "Bug Stream is our internal bug reporting tool."},
            "ru", new String[] {"Приглашение в Bug Stream", "Добро пожаловать в Bug Stream, %s",
                    "Для вас создана учётная запись (%s). Задайте пароль, чтобы войти. Ссылка действует %d дней.",
                    "Задать пароль", "Bug Stream — наш внутренний сервис отчётов об ошибках."},
            "az", new String[] {"Bug Stream-ə dəvət", "Bug Stream-ə xoş gəlmisiniz, %s",
                    "Sizin üçün hesab yaradılıb (%s). Daxil olmaq üçün parol təyin edin. Link %d gün etibarlıdır.",
                    "Parol təyin et", "Bug Stream — daxili xəta hesabatları xidmətimizdir."});

    static Mail loginCode(String locale, String code, int minutes) {
        String[] t = pick(CODE, locale);
        String body = String.format(t[2], minutes);
        return new Mail(String.format(t[0], code),
                t[1] + "\n\n" + code + "\n\n" + body + "\n\n" + t[3],
                MailLayout.html(t[1], MailLayout.code(code) + MailLayout.p(body), null, null, t[3]));
    }

    static Mail resetLink(String locale, String email, String link, int minutes) {
        String[] t = pick(RESET, locale);
        String body = String.format(t[2], email, minutes);
        return new Mail(t[0], t[1] + "\n\n" + body + "\n\n" + t[3] + ": " + link + "\n\n" + t[4],
                MailLayout.html(t[1], MailLayout.p(body), t[3], link, t[4]));
    }

    static Mail invite(String locale, String name, String email, String link, int days) {
        String[] t = pick(INVITE, locale);
        String title = String.format(t[1], name);
        String body = String.format(t[2], email, days);
        return new Mail(t[0], title + "\n\n" + body + "\n\n" + t[3] + ": " + link + "\n\n" + t[4],
                MailLayout.html(title, MailLayout.p(body), t[3], link, t[4]));
    }

    private static String[] pick(Map<String, String[]> m, String locale) {
        return m.getOrDefault(locale == null ? "en" : locale, m.get("en"));
    }
}

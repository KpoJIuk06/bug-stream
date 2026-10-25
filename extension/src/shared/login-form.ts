import { authConfig, errorText, login, loginWithCode, normalizeServer, requestEmailCode, type AuthConfig } from "./api";
import { getLocale, t } from "./i18n";

/**
 * Sign-in form shared by the popup and the preview page. It asks the server which methods are on
 * (password — local account or AD / LDAP; one-time e-mail code) and shows only those.
 * Rendered with textContent / static markup only — nothing from the server is inserted as HTML.
 */
export function mountLogin(root: HTMLElement, defaultServer: string, onDone: () => void | Promise<void>): void {
  root.innerHTML = `
    <form class="lf-form">
      <label class="field"><span data-k="Server address"></span><input name="server" type="text" placeholder="https://bugs.example.com" required />
        <small data-k="Address of the Bug Stream site in your network"></small></label>
      <div class="lf-tabs hidden" role="tablist">
        <button type="button" data-mode="password" data-k="Password"></button>
        <button type="button" data-mode="code" data-k="E-mail code"></button>
      </div>
      <div class="lf-password">
        <label class="field"><span class="lf-login-label"></span><input name="login" type="text" autocomplete="username" /></label>
        <label class="field"><span data-k="Password"></span><input name="password" type="password" autocomplete="current-password" /></label>
      </div>
      <div class="lf-code hidden">
        <label class="field lf-email"><span data-k="E-mail"></span><input name="email" type="email" autocomplete="email" />
          <small data-k="We will send a one-time code — no password needed."></small></label>
        <p class="lf-sent hidden"></p>
        <label class="field lf-codefield hidden"><span data-k="Code from the e-mail"></span>
          <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" class="lf-codeinput" /></label>
      </div>
      <div class="error-box hidden lf-error" style="margin-bottom: 12px"></div>
      <button class="btn primary block lf-submit" type="submit"></button>
      <p class="lf-links"><button type="button" class="lf-link lf-other hidden" data-k="Another e-mail"></button>
        <button type="button" class="lf-link lf-resend hidden" data-k="Send again"></button></p>
    </form>`;
  root.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => (el.textContent = t(el.dataset.k!)));

  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const form = q<HTMLFormElement>(".lf-form");
  const server = q<HTMLInputElement>('input[name="server"]');
  const loginInput = q<HTMLInputElement>('input[name="login"]');
  const password = q<HTMLInputElement>('input[name="password"]');
  const email = q<HTMLInputElement>('input[name="email"]');
  const code = q<HTMLInputElement>('input[name="code"]');
  const submit = q<HTMLButtonElement>(".lf-submit");
  const errorBox = q<HTMLElement>(".lf-error");
  const show = (el: HTMLElement, v: boolean) => el.classList.toggle("hidden", !v);

  let cfg: AuthConfig = { password: true, passwordReset: false, ldap: false, emailCode: false };
  let mode: "password" | "code" = "password";
  let sentTo: string | null = null;

  const setError = (text: string | null) => {
    errorBox.textContent = text ?? "";
    show(errorBox, !!text);
  };

  const render = () => {
    const pwd = cfg.password || cfg.ldap;
    show(q(".lf-tabs"), pwd && cfg.emailCode);
    root.querySelectorAll<HTMLButtonElement>(".lf-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    show(q(".lf-password"), mode === "password");
    show(q(".lf-code"), mode === "code");
    loginInput.required = password.required = mode === "password";
    q(".lf-login-label").textContent = cfg.ldap ? t("Work login or e-mail") : t("E-mail");
    email.required = mode === "code" && !sentTo;
    code.required = mode === "code" && !!sentTo;
    show(q(".lf-email"), !sentTo);
    show(q(".lf-sent"), !!sentTo);
    show(q(".lf-codefield"), !!sentTo);
    show(q(".lf-other"), mode === "code" && !!sentTo);
    show(q(".lf-resend"), mode === "code" && !!sentTo);
    if (sentTo) q(".lf-sent").textContent = t("If {email} can sign in, a 6-digit code is on its way. It is valid for 10 minutes.", { email: sentTo });
    submit.textContent = mode === "code" && !sentTo ? t("Send code") : t("Sign in");
  };

  const loadConfig = async () => {
    const s = server.value.trim();
    if (!s) return;
    try {
      cfg = await authConfig(normalizeServer(s));
      if (mode === "code" && !cfg.emailCode) mode = "password";
      if (mode === "password" && !cfg.password && !cfg.ldap && cfg.emailCode) mode = "code";
      setError(null);
    } catch {
      /* unreachable server — the sign-in attempt will show the error */
    }
    render();
  };

  root.querySelectorAll<HTMLButtonElement>(".lf-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode as "password" | "code";
      setError(null);
      render();
    }),
  );
  q(".lf-other").addEventListener("click", () => {
    sentTo = null;
    code.value = "";
    setError(null);
    render();
  });
  q(".lf-resend").addEventListener("click", async () => {
    if (!sentTo) return;
    try {
      await requestEmailCode(normalizeServer(server.value), sentTo, getLocale());
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  });
  server.addEventListener("change", () => void loadConfig());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    setError(null);
    const label = submit.textContent;
    submit.textContent = mode === "code" && !sentTo ? t("Sending…") : t("Signing in…");
    try {
      const s = normalizeServer(server.value);
      if (mode === "password") {
        await login(s, loginInput.value.trim(), password.value);
        await onDone();
      } else if (!sentTo) {
        await requestEmailCode(s, email.value.trim(), getLocale());
        sentTo = email.value.trim();
        render();
        code.focus();
      } else {
        await loginWithCode(s, sentTo, code.value.replace(/\s+/g, ""));
        await onDone();
      }
    } catch (err) {
      setError(errorText(err));
      submit.textContent = label;
    } finally {
      submit.disabled = false;
    }
  });

  server.value = defaultServer;
  render();
  void loadConfig();
  (defaultServer && defaultServer !== "http://localhost" ? loginInput : server).focus();
}

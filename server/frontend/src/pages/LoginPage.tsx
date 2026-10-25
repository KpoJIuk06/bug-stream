import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { errorText, loginWithCode, setPasswordFromLink } from "../api/client";
import { useAuthConfig, useForgotPassword, usePasswordLink, useRequestEmailCode } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitch, Logo } from "../components/Layout";
import { Button, cx, ErrorBox, Field, Input, Loading } from "../components/ui";
import { t, useI18n } from "../i18n";

/**
 * Sign-in page. It offers only the methods switched on in Administration → Sign-in:
 *  - password (local account and / or AD / LDAP) with "Forgot password?" when reset by e-mail is on;
 *  - one-time code by e-mail.
 * When the password method is off, a small "Administrator sign-in" link stays: administrators keep their local password.
 */
type Mode = "password" | "code" | "forgot";

export function LoginPage() {
  const { user } = useAuth();
  const location = useLocation();
  const config = useAuthConfig();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const c = config.data;
  const passwordOn = !!c && (c.password || c.ldap);
  const [mode, setMode] = useState<Mode | null>(null);
  const [adminOnly, setAdminOnly] = useState(false);

  if (user) return <Navigate to={from} replace />;
  if (config.isLoading) return <Loading />;

  const active: Mode = mode ?? (passwordOn || !c?.emailCode ? "password" : "code");
  const tabs = passwordOn && c?.emailCode;

  return (
    <AuthShell
      title={active === "forgot" ? t("Reset password") : t("Sign in")}
      subtitle={
        active === "forgot"
          ? t("Enter the e-mail of your account — we will send a link to set a new password.")
          : c?.ldap
            ? t("Bug reports with video, console and network. Sign in with your work account.")
            : t("Bug reports with video, console and network.")
      }
    >
      {config.error && <ErrorBox>{errorText(config.error)}</ErrorBox>}
      {tabs && active !== "forgot" && (
        <div className="mb-5 grid grid-cols-2 rounded-control border border-line bg-fog p-0.5 text-[13px]" role="tablist">
          {(["password", "code"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active === m}
              onClick={() => setMode(m)}
              className={cx("h-8 rounded-[5px] font-medium", active === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              {m === "password" ? t("Password") : t("E-mail code")}
            </button>
          ))}
        </div>
      )}
      {active === "password" && (passwordOn || adminOnly || !c?.emailCode) && (
        <PasswordForm ldap={!!c?.ldap} onForgot={c?.passwordReset ? () => setMode("forgot") : undefined} />
      )}
      {active === "code" && !adminOnly && <CodeForm />}
      {active === "forgot" && <ForgotForm onBack={() => setMode("password")} />}
      {!passwordOn && c?.emailCode && (
        <p className="mt-6 text-center text-[12px] text-faint">
          <button
            type="button"
            className="hover:text-muted hover:underline"
            onClick={() => {
              setAdminOnly(!adminOnly);
              setMode(adminOnly ? "code" : "password");
            }}
          >
            {adminOnly ? t("Sign in with an e-mail code") : t("Administrator sign-in")}
          </button>
        </p>
      )}
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-[380px]">
        <div className="mb-7">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="w-36">
              <LanguageSwitch compact />
            </div>
          </div>
          <h1 className="mt-6 text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordForm({ ldap, onForgot }: { ldap: boolean; onForgot?: () => void }) {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await login(name, password);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={ldap ? t("Work login or e-mail") : t("E-mail")} hint={ldap ? t("For example: j.smith or j.smith@example.com") : undefined}>
        <Input type={ldap ? "text" : "email"} autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label={t("Password")}>
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? t("Signing in…") : t("Sign in")}
      </Button>
      {onForgot && (
        <p className="text-center text-[13px]">
          <button type="button" className="text-primary hover:underline" onClick={onForgot}>
            {t("Forgot password?")}
          </button>
        </p>
      )}
    </form>
  );
}

const RESEND_SECONDS = 60;

function CodeForm() {
  const { locale } = useI18n();
  const { setUser } = useAuth();
  const request = useRequestEmailCode();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const send = (to: string) =>
    request.mutate(
      { email: to, locale },
      {
        onSuccess: () => {
          setSentTo(to);
          setCode("");
          setError(null);
          setWait(RESEND_SECONDS);
        },
        onError: (err) => setError(errorText(err)),
      },
    );

  if (!sentTo) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(email.trim());
        }}
      >
        <Field label={t("E-mail")} hint={t("We will send a one-time code — no password needed.")}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" variant="primary" className="w-full" disabled={request.isPending}>
          {request.isPending ? t("Sending…") : t("Send code")}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          setUser(await loginWithCode(sentTo, code));
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="rounded-control border border-line bg-fog px-3 py-2 text-[13px] text-muted">
        {t("If {email} can sign in, a 6-digit code is on its way. It is valid for 10 minutes.", { email: sentTo })}
      </p>
      <Field label={t("Code from the e-mail")}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ""))}
          required
          autoFocus
          className="text-center font-mono text-[20px] tracking-[0.4em]"
        />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? t("Signing in…") : t("Sign in")}
      </Button>
      <div className="flex justify-between text-[13px]">
        <button type="button" className="text-muted hover:text-ink hover:underline" onClick={() => (setSentTo(null), setError(null))}>
          {t("Another e-mail")}
        </button>
        <button type="button" className="text-primary hover:underline disabled:text-faint disabled:no-underline" disabled={wait > 0 || request.isPending} onClick={() => send(sentTo)}>
          {wait > 0 ? t("Send again in {n} s", { n: wait }) : t("Send again")}
        </button>
      </div>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const { locale } = useI18n();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");
  if (forgot.isSuccess) {
    return (
      <div className="space-y-4">
        <p className="rounded-control border border-line bg-fog px-3 py-2 text-[13px] text-muted">
          {t("If {email} has an account with a password, we have sent a link to set a new one. It is valid for 1 hour.", { email })}
        </p>
        <Button className="w-full" onClick={onBack}>
          {t("Back to sign-in")}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        forgot.mutate({ email: email.trim(), locale });
      }}
    >
      <Field label={t("E-mail")}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      {forgot.error && <ErrorBox>{errorText(forgot.error)}</ErrorBox>}
      <Button type="submit" variant="primary" className="w-full" disabled={forgot.isPending}>
        {forgot.isPending ? t("Sending…") : t("Send link")}
      </Button>
      <p className="text-center text-[13px]">
        <button type="button" className="text-muted hover:text-ink hover:underline" onClick={onBack}>
          {t("Back to sign-in")}
        </button>
      </p>
    </form>
  );
}

/** /set-password?token=… — from a password reset or an invitation e-mail. Signs the user in after saving. */
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const info = usePasswordLink(token);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (info.isLoading) return <Loading />;
  if (!token || info.error || !info.data) {
    return (
      <AuthShell title={t("Link expired")} subtitle={t("The link is invalid or has expired — request a new one.")}>
        <Link to="/login" className="text-[13px] text-primary hover:underline">
          {t("Back to sign-in")}
        </Link>
      </AuthShell>
    );
  }
  const invite = info.data.purpose === "INVITE";
  return (
    <AuthShell
      title={invite ? t("Welcome, {name}", { name: info.data.fullName }) : t("Set a new password")}
      subtitle={invite ? t("Set a password for {email} to finish creating your account.", { email: info.data.email }) : info.data.email}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pwd !== pwd2) {
            setError(t("Passwords do not match"));
            return;
          }
          setBusy(true);
          setError(null);
          try {
            setUser(await setPasswordFromLink(token, pwd));
            navigate("/", { replace: true });
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input type="text" autoComplete="username" value={info.data.email} readOnly hidden />
        <Field label={t("New password")} hint={t("At least 8 characters")}>
          <Input type="password" autoComplete="new-password" minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} required autoFocus />
        </Field>
        <Field label={t("Repeat the password")}>
          <Input type="password" autoComplete="new-password" minLength={8} value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? t("Saving…") : invite ? t("Set password and sign in") : t("Save and sign in")}
        </Button>
      </form>
    </AuthShell>
  );
}

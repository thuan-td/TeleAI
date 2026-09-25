import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { login } from "../api/client";
import { TextInput } from "../components/ui/TextInput";

export function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      window.location.href = "/";
    } catch {
      setError(t("auth.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-fg">{t("auth.loginTitle")}</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium text-fg-muted">
            {t("auth.username")}
          </label>
          <TextInput
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-fg-muted">
            {t("auth.password")}
          </label>
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("auth.submitting") : t("auth.submit")}
        </button>
      </form>
    </div>
  );
}

import { Hash, MessagesSquare, Moon, Sun, Zap } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoginForm, RegisterForm } from '@/features/auth';
import { useSession } from '@/entities/session';
import { setLanguage } from '@/shared/i18n';
import { resolveDark, usePrefs } from '@/shared/lib/prefs';
import { Button } from '@/shared/ui';

export function LoginPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const demo = useSession((s) => s.demo);
  const demoLogin = useSession((s) => s.demoLogin);
  const prefs = usePrefs();
  const [busy, setBusy] = useState(false);
  const dark = resolveDark(prefs.theme);

  const runDemo = async (h: 'ali' | 'sara') => {
    setBusy(true);
    try {
      await demoLogin(h);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-primary text-accent-fg">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                <path d="M5 5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4l-4 4v-4H8a3 3 0 0 1-3-3z" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight">{t('common.appName')}</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void setLanguage(prefs.lang === 'en' ? 'fa' : 'en')}
              aria-label={t('settings.language')}
            >
              {prefs.lang === 'en' ? 'فارسی' : 'English'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => prefs.set({ theme: dark ? 'light' : 'dark' })}
              aria-label={t('settings.theme')}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? t('auth.signInTitle') : t('auth.registerTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mode === 'login' ? t('auth.signInSubtitle') : t('auth.registerSubtitle')}
            </p>
          </div>
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          <p className="text-center text-sm text-muted">
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              type="button"
              className="font-semibold text-accent-ink hover:underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? t('auth.signUp') : t('auth.signIn')}
            </button>
          </p>
          {demo && (
            <div className="rounded-2xl border border-dashed border-line-strong p-4">
              <p className="text-sm font-semibold">{t('auth.demoTitle')}</p>
              <p className="mb-3 text-xs text-muted">{t('auth.demoHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  disabled={busy}
                  onClick={() => void runDemo('ali')}
                >
                  {t('auth.demoAdmin')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void runDemo('sara')}
                >
                  {t('auth.demoMember')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden border-s border-line lg:flex lg:items-center lg:justify-center"
        style={{
          background:
            'radial-gradient(900px 520px at 80% 10%, color-mix(in oklab, var(--accent) 28%, transparent), transparent), radial-gradient(700px 500px at 10% 100%, color-mix(in oklab, var(--primary) 40%, transparent), transparent), var(--panel)',
        }}
      >
        <div className="max-w-md space-y-8 p-10">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight">
              {t('auth.heroTitle')}
            </h2>
            <p className="mt-3 text-muted">{t('auth.heroBody')}</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-line bg-surface/70 p-4 shadow-pop backdrop-blur">
            {[
              {
                icon: <Hash className="size-4" />,
                name: 'design-team',
                text: 'Pushed the new onboarding flow to staging 🚀',
              },
              {
                icon: <MessagesSquare className="size-4" />,
                name: 'engineering',
                text: '@sara p95 send latency is 38 ms',
              },
              {
                icon: <Zap className="size-4" />,
                name: 'launch-2026',
                text: 'Load test passed 🎉',
              },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-start gap-3 rounded-xl bg-panel p-3"
                dir="ltr"
              >
                <span className="mt-0.5 grid size-7 place-items-center rounded-lg bg-mention text-accent-ink">
                  {r.icon}
                </span>
                <div className="text-sm">
                  <b className="font-semibold">#{r.name}</b>
                  <p className="text-muted">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

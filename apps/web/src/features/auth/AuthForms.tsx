import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { loginBody, registerBody, type LoginBody, type RegisterBody } from '@team-chat/shared';
import { useSession } from '@/entities/session';
import { ApiClientError } from '@/shared/api/http';
import { Button, Field, Input, Spinner } from '@/shared/ui';

function useAuthError() {
  const { t } = useTranslation();
  return (e: unknown, mode: 'login' | 'register'): string => {
    if (e instanceof ApiClientError) {
      if (e.status === 429) return t('auth.tooMany');
      if (e.status === 401) return t('auth.invalid');
      if (e.status === 409) return /handle/i.test(e.message) && !/email/i.test(e.message) ? t('auth.handleTaken') : t('auth.emailTaken');
      if (e.code === 'network') return t('errors.network');
    }
    return mode === 'login' ? t('auth.invalid') : t('common.error');
  };
}

export function LoginForm() {
  const { t } = useTranslation();
  const login = useSession((s) => s.login);
  const errorText = useAuthError();
  const [error, setError] = useState<string>();
  const f = useForm<LoginBody>({ resolver: zodResolver(loginBody) });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={f.handleSubmit(async (v) => {
        setError(undefined);
        try {
          await login(v);
        } catch (e) {
          setError(errorText(e, 'login'));
        }
      })}
    >
      <Field label={t('auth.email')} error={f.formState.errors.email && t('auth.validation.email')}>
        <Input type="email" autoComplete="email" inputMode="email" dir="ltr" aria-invalid={!!f.formState.errors.email} {...f.register('email')} />
      </Field>
      <Field label={t('auth.password')} error={f.formState.errors.password && t('auth.validation.password')}>
        <Input type="password" autoComplete="current-password" dir="ltr" aria-invalid={!!f.formState.errors.password} {...f.register('password')} />
      </Field>
      {error && <p role="alert" className="rounded-xl border border-danger-ink/40 bg-danger/20 px-3 py-2 text-sm text-danger-ink">{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={f.formState.isSubmitting}>
        {f.formState.isSubmitting && <Spinner />} {t('auth.signIn')}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const { t } = useTranslation();
  const register = useSession((s) => s.register);
  const errorText = useAuthError();
  const [error, setError] = useState<string>();
  const f = useForm<RegisterBody>({ resolver: zodResolver(registerBody) });
  const e = f.formState.errors;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={f.handleSubmit(async (v) => {
        setError(undefined);
        try {
          await register(v);
        } catch (err) {
          setError(errorText(err, 'register'));
        }
      })}
    >
      <Field label={t('auth.name')} error={e.name && t('auth.validation.name')}>
        <Input autoComplete="name" dir="auto" aria-invalid={!!e.name} {...f.register('name')} />
      </Field>
      <Field label={t('auth.handle')} hint={t('auth.handleHint')} error={e.handle && t('auth.validation.handle')}>
        <Input autoComplete="username" dir="ltr" autoCapitalize="none" aria-invalid={!!e.handle} {...f.register('handle')} />
      </Field>
      <Field label={t('auth.email')} error={e.email && t('auth.validation.email')}>
        <Input type="email" autoComplete="email" inputMode="email" dir="ltr" aria-invalid={!!e.email} {...f.register('email')} />
      </Field>
      <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={e.password && t('auth.validation.password')}>
        <Input type="password" autoComplete="new-password" dir="ltr" aria-invalid={!!e.password} {...f.register('password')} />
      </Field>
      {error && <p role="alert" className="rounded-xl border border-danger-ink/40 bg-danger/20 px-3 py-2 text-sm text-danger-ink">{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={f.formState.isSubmitting}>
        {f.formState.isSubmitting && <Spinner />} {t('auth.signUp')}
      </Button>
    </form>
  );
}

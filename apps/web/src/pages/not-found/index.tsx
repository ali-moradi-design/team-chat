import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonStyles } from '@/shared/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-5xl font-bold text-accent">404</p>
        <h1 className="text-xl font-semibold">{t('errors.notFound')}</h1>
        <p className="text-sm text-muted">{t('errors.notFoundBody')}</p>
        <Link to="/" className={buttonStyles({ variant: 'primary' })}>
          {t('errors.goHome')}
        </Link>
      </div>
    </main>
  );
}

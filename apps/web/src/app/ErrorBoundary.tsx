import { Component, type ReactNode } from 'react';
import { i18next } from '@/shared/i18n';
import { Button } from '@/shared/ui';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error(error);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-lg font-semibold">{i18next.t('errors.boundary')}</h1>
          <Button variant="primary" onClick={() => location.reload()}>
            {i18next.t('errors.reload')}
          </Button>
        </div>
      </div>
    );
  }
}

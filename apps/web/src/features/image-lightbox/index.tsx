import { Download, X } from 'lucide-react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useDialogs } from '@/shared/lib/dialogs';
import { Button } from '@/shared/ui';

export function ImageLightbox() {
  const { t } = useTranslation();
  const a = useDialogs((s) => s.lightbox);
  const set = useDialogs((s) => s.setLightbox);
  return (
    <RadixDialog.Root open={!!a} onOpenChange={(o) => !o && set(null)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 animate-fade bg-black/85" />
        <RadixDialog.Content
          className="fixed inset-0 z-50 flex flex-col focus:outline-none"
          onClick={() => set(null)}
        >
          <RadixDialog.Title className="sr-only">
            {a?.name ?? t('message.openImage')}
          </RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{a?.name ?? ''}</RadixDialog.Description>
          <div
            className="flex items-center justify-between gap-3 p-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate text-sm font-medium" dir="auto">
              {a?.name}
            </span>
            <div className="flex gap-1">
              {a && (
                <a
                  href={a.url}
                  download={a.name}
                  aria-label={t('message.download')}
                  className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
                >
                  <Download className="size-5" />
                </a>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.close')}
                onClick={() => set(null)}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center p-3 pt-0">
            {a && (
              <img
                src={a.url}
                alt={a.name}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

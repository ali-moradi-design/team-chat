import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSession } from '@/entities/session';
import { useUsers, UserAvatar } from '@/entities/user';
import { api } from '@/shared/api/http';
import { useDialogs } from '@/shared/lib/dialogs';
import { Button, Dialog } from '@/shared/ui';

export function AdminDialog() {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.admin);
  const close = useDialogs((s) => s.close);
  const me = useSession((s) => s.me)!;
  const users = useUsers((s) => s.byId);
  const list = Object.values(users)
    .filter((u) => !u.isBot)
    .sort((a, b) => a.name.localeCompare(b.name));

  const setRole = async (id: string, role: 'admin' | 'member') => {
    try {
      await api(`/api/users/${id}/role`, { method: 'PATCH', body: { role } });
      toast.success(t('admin.changed'));
    } catch {
      toast.error(t('admin.failed'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close('admin')}
      title={t('admin.title')}
      mobileSheet
    >
      <ul className="divide-y divide-line">
        {list.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-5 py-3">
            <UserAvatar userId={u.id} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium" dir="auto">
                {u.name}
              </span>
              <span className="block truncate text-xs text-muted">
                {u.role === 'admin' ? t('settings.admin') : t('settings.member')} · @{u.handle}
              </span>
            </span>
            {u.id !== me.id && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void setRole(u.id, u.role === 'admin' ? 'member' : 'admin')}
              >
                {u.role === 'admin' ? t('admin.makeMember') : t('admin.makeAdmin')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

import { Avatar } from '@/shared/ui';
import { displayName, usePresenceOf, useUser } from '../model';

export function UserAvatar({
  userId,
  size = 'md',
  withPresence = false,
}: {
  userId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  withPresence?: boolean;
}) {
  const user = useUser(userId);
  const presence = usePresenceOf(userId);
  return (
    <Avatar
      name={displayName(user)}
      hue={user?.hue ?? 20}
      size={size}
      {...(user?.isBot ? { isBot: true } : {})}
      presence={withPresence ? presence : undefined}
    />
  );
}

import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';

interface UserNameLinkProps {
  userId: string;
  initialUsername: string;
}

export function UserNameLink({ userId, initialUsername }: UserNameLinkProps) {
  const { userData, loading } = useUserData(userId);
  
  const displayName = userData?.username || initialUsername;

  return (
    <Link
      href={`/profile/${userId}`}
      className="hover:text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {displayName}
    </Link>
  );
}
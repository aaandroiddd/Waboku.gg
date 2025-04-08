import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';
import { Skeleton } from '@/components/ui/skeleton';

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showProfileOnClick?: boolean;
}

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = "", 
  showProfileOnClick = true 
}: UserNameLinkProps) {
  const initialData = initialUsername ? { username: initialUsername } : undefined;
  const { userData, loading } = useUserData(userId, initialData);
  
  const displayName = userData?.username || initialUsername || 'Unknown User';
  
  if (loading && !initialUsername) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }
  
  if (showProfileOnClick) {
    return (
      <Link 
        href={`/profile/${userId}`} 
        className={`font-medium hover:underline ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {displayName}
      </Link>
    );
  }
  
  return <span className={`font-medium ${className}`}>{displayName}</span>;
}
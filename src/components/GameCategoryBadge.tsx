import { useRouter } from 'next/router';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { GAME_NAME_MAPPING } from '@/components/GameCategories';

interface GameCategoryBadgeProps extends BadgeProps {
  game: string;
}

export function GameCategoryBadge({ game, className, variant = 'secondary', ...props }: GameCategoryBadgeProps) {
  const router = useRouter();

  // Find the game category key from the game name
  const findGameCategory = (gameName: string): string | null => {
    const lowerGameName = gameName.toLowerCase();
    
    // Check all game mappings to find a match
    for (const [category, variations] of Object.entries(GAME_NAME_MAPPING)) {
      if (variations.some(name => name.toLowerCase() === lowerGameName)) {
        return category;
      }
    }
    
    return null;
  };

  const handleClick = () => {
    const gameCategory = findGameCategory(game);
    
    if (gameCategory) {
      router.push({
        pathname: '/listings',
        query: { game: gameCategory }
      });
    } else {
      // If we can't find a mapping, just use the game name as is
      router.push({
        pathname: '/listings',
        query: { game: game.toLowerCase() }
      });
    }
  };

  return (
    <Badge 
      variant={variant} 
      className={`cursor-pointer hover:opacity-80 ${className || ''}`} 
      onClick={handleClick}
      {...props}
    >
      {game}
    </Badge>
  );
}
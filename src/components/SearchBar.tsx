import { useRouter } from 'next/router';
import CardSearchInput from '@/components/CardSearchInput';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  set: {
    name: string;
    series: string;
  };
  images: {
    small: string;
  };
  type: 'pokemon';
}

interface MtgCard {
  id: string;
  name: string;
  collector_number: string;
  set_name: string;
  image_uris?: {
    small: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small: string;
    };
  }>;
  type: 'mtg';
}

interface OnePieceCard {
  id: string;
  name: string;
  card_number: string;
  set_name: string;
  image_url: string;
  type: 'onepiece';
}

type Card = PokemonCard | MtgCard | OnePieceCard;

interface SearchBarProps {
  showSearchButton?: boolean;
  initialValue?: string;
}

export default function SearchBar({ showSearchButton = false, initialValue = "" }: SearchBarProps) {
  const router = useRouter();
  const { recordSearch } = useTrendingSearches();

  const handleSearch = async (query: string) => {
    if (query.trim()) {
      await recordSearch(query.trim());
      // Preserve existing query parameters and update only the search query
      const currentQuery = router.query;
      router.push({
        pathname: '/listings',
        query: { 
          ...currentQuery,
          query: query.trim()
        }
      });
    }
  };

  const handleCardSelect = async (card: any) => {
    let searchTerm;
    switch (card.type) {
      case 'pokemon':
        searchTerm = `${card.name} ${card.number}`;
        break;
      case 'mtg':
        searchTerm = `${card.name} ${card.collector_number}`;
        break;
      case 'onepiece':
        searchTerm = `${card.name} ${card.card_number}`;
        break;
    }
    
    if (searchTerm) {
      await recordSearch(searchTerm.trim());
      const currentQuery = router.query;
      router.push({
        pathname: '/listings',
        query: { 
          ...currentQuery,
          query: searchTerm.trim(),
          game: card.type
        }
      });
    }
  };

  return (
    <CardSearchInput
      onCardSelect={handleCardSelect}
      onSearch={handleSearch}
      showSearchButton={showSearchButton}
      initialValue={initialValue}
    />
  );
}
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
  selectedState?: string;
}

export default function SearchBar({ showSearchButton = false, initialValue = "", selectedState = "all" }: SearchBarProps) {
  const router = useRouter();
  const { recordSearch } = useTrendingSearches();

  const handleSearch = async (query: string) => {
    // If query has content, record it
    if (query.trim()) {
      await recordSearch(query.trim());
    }
    
    // Preserve existing query parameters and update only the search query
    const currentQuery = router.query;
    
    // Create new query object
    const newQuery: any = { ...currentQuery };
    
    // If query has content, add it to the query params
    if (query.trim()) {
      newQuery.query = query.trim();
    } else {
      // If query is empty, remove it from query params to show all listings
      delete newQuery.query;
    }
    
    // Include the selected state in the search query if not "all"
    if (selectedState !== 'all') {
      newQuery.state = selectedState;
    }
    
    router.push({
      pathname: '/listings',
      query: newQuery
    });
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
          game: card.type,
          // Include the selected state in the search query
          ...(selectedState !== 'all' && { state: selectedState })
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
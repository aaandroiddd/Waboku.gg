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
  onSearch?: (query: string) => void;
  onSelect?: (cardName: string) => void;
}

export default function SearchBar({ 
  showSearchButton = false, 
  initialValue = "", 
  selectedState = "all",
  onSearch,
  onSelect
}: SearchBarProps) {
  const router = useRouter();
  const { recordSearch } = useTrendingSearches();

  const handleSearch = async (query: string) => {
    // If custom onSearch handler is provided, use it
    if (onSearch) {
      onSearch(query);
      return;
    }
    
    // If query has content, try to record it but don't wait for it to complete
    if (query.trim()) {
      try {
        // Use Promise.race with a timeout to prevent blocking the search
        await Promise.race([
          recordSearch(query.trim()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Search recording timeout')), 1000)
          )
        ]).catch(error => {
          console.warn('Search recording timed out or failed:', error);
          // Continue with search regardless of recording success
        });
      } catch (error) {
        console.error('Error recording search:', error);
        // Continue with search regardless of recording error
      }
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
    
    console.log('Navigating to listings with query:', newQuery);
    
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
      // If custom onSelect handler is provided, use it
      if (onSelect) {
        onSelect(searchTerm.trim());
        return;
      }
      
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
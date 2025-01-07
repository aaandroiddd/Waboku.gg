import { useRouter } from 'next/router';
import CardSearchInput from '@/components/CardSearchInput';

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

export default function SearchBar() {
  const router = useRouter();

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push({
        pathname: '/listings',
        query: { 
          query: query.trim()
        }
      });
    }
  };

  const handleCardSelect = (card: any) => {
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
    
    router.push({
      pathname: '/listings',
      query: { 
        query: searchTerm.trim(),
        game: card.type
      }
    });
  };

  return (
    <CardSearchInput
      onCardSelect={handleCardSelect}
      onSearch={handleSearch}
    />
  );
}
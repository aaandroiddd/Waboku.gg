import EnhancedSearchBar from '@/components/EnhancedSearchBar';

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
  return (
    <EnhancedSearchBar
      onSearch={onSearch}
      onSelect={onSelect}
      showSearchButton={showSearchButton}
      initialValue={initialValue}
      selectedState={selectedState}
      placeholder="Search for cards, sets, or listings..."
    />
  );
}
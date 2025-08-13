import EnhancedSearchBar from '@/components/EnhancedSearchBar';

interface SearchInputWithSuggestionsProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showSearchButton?: boolean;
  initialValue?: string;
  isLoading?: boolean;
}

const SearchInputWithSuggestions: React.FC<SearchInputWithSuggestionsProps> = ({ 
  placeholder = "Search cards...",
  onSearch,
  showSearchButton = false,
  initialValue = "",
  isLoading = false
}) => {
  return (
    <EnhancedSearchBar
      placeholder={placeholder}
      onSearch={onSearch}
      showSearchButton={showSearchButton}
      initialValue={initialValue}
      isLoading={isLoading}
    />
  );
};

export default SearchInputWithSuggestions;
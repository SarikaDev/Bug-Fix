import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import type { SearchOptionValue } from "../btn-dropdown/DropDown";
interface SearchBarProps {
  searchMode: SearchOptionValue;
}
const SearchBar = ({ searchMode }: SearchBarProps) => {
  const [query, setQuery] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
  };

  const clearSearch = () => {
    setQuery("");
  };
  return (
    <div className="relative">
      <Search className="absolute left-3 top-7 -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder={
          searchMode === "Manual Entry"
            ? "Type and press Enter to search..."
            : "Search users by name, email, or company..."
        }
        className="w-full pl-10 pr-10 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm transition-colors"
        autoComplete="off"
      />
      {query && (
        <button
          onClick={clearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Search Strategy</h3>
        </div>
        {/* <p className="text-sm text-gray-600">{currentStrategy?.description}</p> */}
      </div>
    </div>
  );
};

export default SearchBar;

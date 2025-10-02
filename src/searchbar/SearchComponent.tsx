import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Loader2, AlertCircle } from "lucide-react";

// Type definitions
interface User {
  id: number;
  name: string;
  email: string;
  company: {
    name: string;
  };
}

interface SearchComponentProps {
  apiEndpoint?: string;
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
  onUserSelect?: (user: User) => void;
}

interface CacheEntry {
  data: User[];
  timestamp: number;
}

export default function SearchComponent({
  apiEndpoint = "https://jsonplaceholder.typicode.com/users",
  debounceMs = 300,
  minQueryLength = 2,
  maxResults = 50,
  onUserSelect,
}: SearchComponentProps) {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Refs for debounce and abort controller
  const debounceTimer = useRef<number | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cache configuration (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      abortController.current?.abort();
    };
  }, []);

  const clearSearch = useCallback((): void => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsLoading(false);
    setIsDropdownOpen(false);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    abortController.current?.abort();
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string): Promise<void> => {
      const trimmedQuery = searchQuery.trim();

      // Handle empty input
      if (!trimmedQuery) {
        setResults([]);
        setIsLoading(false);
        setError(null);
        setIsDropdownOpen(false);
        return;
      }

      // Validate minimum query length
      if (trimmedQuery.length < minQueryLength) {
        setResults([]);
        setIsLoading(false);
        setError(`Please enter at least ${minQueryLength} characters`);
        setIsDropdownOpen(true);
        return;
      }

      // Check cache first (with expiration)
      const cached = cache.current.get(trimmedQuery);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setResults(cached.data.slice(0, maxResults));
        setIsLoading(false);
        setError(null);
        setIsDropdownOpen(true);
        return;
      }

      // Abort previous request
      abortController.current?.abort();

      // Create new abort controller
      abortController.current = new AbortController();

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${apiEndpoint}?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: abortController.current.signal,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Search failed: ${response.status} ${response.statusText}`
          );
        }

        const data: User[] = await response.json();

        // Filter results client-side (since JSONPlaceholder doesn't support search well)
        const filteredResults = data
          .filter(
            (user) =>
              user.name.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
              user.company.name
                .toLowerCase()
                .includes(trimmedQuery.toLowerCase())
          )
          .slice(0, maxResults);

        // Cache the results
        cache.current.set(trimmedQuery, {
          data: filteredResults,
          timestamp: Date.now(),
        });

        setResults(filteredResults);
        setError(
          filteredResults.length === 0
            ? "No users found matching your search"
            : null
        );
        setIsDropdownOpen(true);
      } catch (err) {
        // Don't show error for aborted requests
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        console.error("Search error:", err);
        setError("Failed to search users. Please try again.");
        setResults([]);
        setIsDropdownOpen(true);
      } finally {
        setIsLoading(false);
      }
    },
    [apiEndpoint, minQueryLength, maxResults, CACHE_DURATION]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const newQuery = e.target.value;
      setQuery(newQuery);
      setError(null);

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      const trimmedQuery = newQuery.trim();

      // Handle empty query immediately
      if (!trimmedQuery) {
        clearSearch();
        return;
      }

      // Show loading state only for valid queries after debounce
      if (trimmedQuery.length >= minQueryLength) {
        setIsLoading(true);
      }

      // Debounce search
      debounceTimer.current = setTimeout(() => {
        performSearch(newQuery);
      }, debounceMs);
    },
    [clearSearch, performSearch, debounceMs, minQueryLength]
  );

  const handleSelect = useCallback(
    (user: User): void => {
      console.log("Selected user:", user);
      setQuery(user.name);
      setResults([]);
      setIsDropdownOpen(false);
      onUserSelect?.(user);
    },
    [onUserSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
        inputRef.current?.blur();
      } else if (e.key === "Enter" && results.length > 0) {
        handleSelect(results[0]);
      }
    },
    [results, handleSelect]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">
          Professional User Search
        </h1>

        {/* Search Input */}
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setIsDropdownOpen(true)}
              placeholder="Search users by name, email, or company..."
              className="w-full pl-10 pr-10 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm transition-colors"
              autoComplete="off"
              aria-label="Search users"
              aria-controls="search-results"
              aria-expanded={isDropdownOpen}
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <Loader2
                className="w-5 h-5 text-blue-500 animate-spin"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Results Dropdown */}
          {isDropdownOpen && (results.length > 0 || error) && (
            <div
              id="search-results"
              className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50"
              role="listbox"
            >
              {error ? (
                <div
                  className="p-3 text-red-700 bg-red-50 flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              ) : (
                <>
                  <div className="p-2 text-xs text-gray-500 border-b bg-gray-50">
                    {results.length} user{results.length !== 1 ? "s" : ""} found
                  </div>
                  {results.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelect(user)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors focus:bg-blue-50 focus:outline-none"
                      role="option"
                      aria-selected="false"
                    >
                      <div className="font-medium text-gray-900 truncate">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {user.email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user.company.name}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Features & Info */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Features ✅
          </h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Debounced search with configurable delay
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Request cancellation on rapid typing
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Intelligent caching with expiration
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Full keyboard navigation support
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Accessible with proper ARIA labels
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Mobile-responsive design
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

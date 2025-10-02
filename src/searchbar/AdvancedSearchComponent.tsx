/* eslint-disable @typescript-eslint/no-explicit-any */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  Settings,
  Zap,
  Shield,
  Smartphone,
} from "lucide-react";
import useClickOutside from "../bank/hooks/useClickOutside";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface User {
  id: number;
  name: string;
  email: string;
  company: {
    name: string;
  };
}

interface ApiResult {
  isLoading: boolean;
  error: string | null;
  results: User[];
  isDropdownOpen: boolean;
}
type SearchMode = "instant" | "balanced" | "conservative" | "manual";

interface SearchStrategy {
  id: SearchMode;
  name: string;
  description: string;
  icon: React.ReactNode;
  recommendedFor: string;
}

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

interface SearchStats {
  apiCalls: number;
  cacheHits: number;
  localSearches: number;
}

interface SearchComponentProps {
  apiEndpoint?: string | ((query: string) => string);
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
  onUserSelect?: (user: User) => void;
  defaultStrategy?: SearchMode;
  rateLimit?: number;
  rateLimitWindow?: number;
  cacheDuration?: number;
  maxCacheSize?: number;
  showStats?: boolean;
  showStrategySelector?: boolean;
  searchFields?: (keyof User)[];
}

interface SearchResult<T> {
  data: T[];
  source: "cache" | "api" | "local" | "rate_limited";
  error?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const createRateLimiter = (limit: number, windowMs: number = 60000) => {
  const requests: number[] = [];

  const cleanup = () => {
    const cutoff = Date.now() - windowMs;
    for (let i = requests.length - 1; i >= 0; i--) {
      if (requests[i] <= cutoff) {
        requests.splice(i, 1);
      }
    }
  };

  return {
    isLimited: () => {
      cleanup();
      return requests.length >= limit;
    },
    record: () => {
      requests.push(Date.now());
    },
    reset: () => {
      requests.length = 0;
    },
    remaining: () => {
      cleanup();
      return Math.max(0, limit - requests.length);
    },
  };
};

const createSearchCache = <T,>(duration: number, maxSize: number = 50) => {
  const cache = new Map<string, CacheEntry<T>>();

  return {
    get: (query: string): T[] | null => {
      const entry = cache.get(query);
      if (!entry) return null;

      if (Date.now() - entry.timestamp > duration) {
        cache.delete(query);
        return null;
      }

      return entry.data;
    },

    set: (query: string, data: T[]): void => {
      if (cache.size >= maxSize) {
        const firstKey = Array.from(cache.keys())[0];
        if (firstKey) cache.delete(firstKey);
      }

      cache.set(query, {
        data,
        timestamp: Date.now(),
      });
    },

    fuzzyMatch: (query: string): T[] | null => {
      const lowerQuery = query.toLowerCase();

      for (const [cachedQuery, entry] of cache.entries()) {
        if (Date.now() - entry.timestamp > duration) continue;

        const lowerCached = cachedQuery.toLowerCase();
        if (
          lowerQuery.startsWith(lowerCached) ||
          lowerCached.includes(lowerQuery)
        ) {
          return entry.data;
        }
      }

      return null;
    },

    clear: (): void => {
      cache.clear();
    },

    get size(): number {
      return cache.size;
    },
  };
};

// ============================================================================
// SEARCH STRATEGY IMPLEMENTATIONS
// ============================================================================

const createInstantSearchStrategy = <T,>(
  cache: ReturnType<typeof createSearchCache<T>>,
  rateLimiter: ReturnType<typeof createRateLimiter>
) => {
  const tryApiSearch = async (
    query: string,
    apiSearch: (q: string) => Promise<T[]>
  ): Promise<SearchResult<T>> => {
    if (rateLimiter.isLimited()) {
      return {
        data: [],
        source: "rate_limited",
        error: "Rate limit exceeded. Please slow down.",
      };
    }

    try {
      const data = await apiSearch(query);
      rateLimiter.record();
      cache.set(query, data);
      return { data, source: "api" };
    } catch (error) {
      return {
        data: [],
        source: "api",
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  };

  return {
    execute: async (
      query: string,
      apiSearch: (q: string) => Promise<T[]>
    ): Promise<SearchResult<T>> => {
      return tryApiSearch(query, apiSearch);
    },
  };
};

const createBalancedSearchStrategy = <T,>(
  cache: ReturnType<typeof createSearchCache<T>>,
  rateLimiter: ReturnType<typeof createRateLimiter>
) => {
  const tryApiSearch = async (
    query: string,
    apiSearch: (q: string) => Promise<T[]>
  ): Promise<SearchResult<T>> => {
    if (rateLimiter.isLimited()) {
      return {
        data: [],
        source: "rate_limited",
        error: "Rate limit exceeded. Please slow down.",
      };
    }

    try {
      const data = await apiSearch(query);
      rateLimiter.record();
      cache.set(query, data);
      return { data, source: "api" };
    } catch (error) {
      return {
        data: [],
        source: "api",
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  };

  return {
    execute: async (
      query: string,
      apiSearch: (q: string) => Promise<T[]>,
      localSearch: (q: string) => T[]
    ): Promise<SearchResult<T>> => {
      const cached = cache.get(query);
      if (cached) {
        return { data: cached, source: "cache" };
      }

      const fuzzyMatch = cache.fuzzyMatch(query);
      if (fuzzyMatch) {
        return { data: fuzzyMatch, source: "cache" };
      }

      const apiResult = await tryApiSearch(query, apiSearch);
      if (apiResult.error && apiResult.data.length === 0) {
        const localData = localSearch(query);
        if (localData.length > 0) {
          return {
            data: localData,
            source: "local",
            error: "Showing local results (API unavailable)",
          };
        }
      }

      return apiResult;
    },
  };
};

const createConservativeSearchStrategy = <T,>(
  cache: ReturnType<typeof createSearchCache<T>>,
  rateLimiter: ReturnType<typeof createRateLimiter>
) => {
  const tryApiSearch = async (
    query: string,
    apiSearch: (q: string) => Promise<T[]>
  ): Promise<SearchResult<T>> => {
    if (rateLimiter.isLimited()) {
      return {
        data: [],
        source: "rate_limited",
        error: "Rate limit exceeded. Please slow down.",
      };
    }

    try {
      const data = await apiSearch(query);
      rateLimiter.record();
      cache.set(query, data);
      return { data, source: "api" };
    } catch (error) {
      return {
        data: [],
        source: "api",
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  };

  return {
    execute: async (
      query: string,
      apiSearch: (q: string) => Promise<T[]>,
      localSearch: (q: string) => T[]
    ): Promise<SearchResult<T>> => {
      if (query.length <= 3) {
        const localData = localSearch(query);
        return {
          data: localData,
          source: "local",
          error:
            localData.length === 0
              ? "Type more characters for API search"
              : undefined,
        };
      }

      const cached = cache.get(query) || cache.fuzzyMatch(query);
      if (cached) {
        return { data: cached, source: "cache" };
      }

      if (rateLimiter.isLimited()) {
        const localData = localSearch(query);
        return {
          data: localData,
          source: "rate_limited",
          error: "Rate limited. Showing local results.",
        };
      }

      return tryApiSearch(query, apiSearch);
    },
  };
};

const createManualSearchStrategy = <T,>(
  cache: ReturnType<typeof createSearchCache<T>>
) => {
  return {
    execute: async (
      query: string,
      _apiSearch: (q: string) => Promise<T[]>,
      localSearch: (q: string) => T[]
    ): Promise<SearchResult<T>> => {
      const cached = cache.get(query);
      if (cached) {
        return { data: cached, source: "cache" };
      }

      const localData = localSearch(query);
      return {
        data: localData,
        source: "local",
        error:
          localData.length === 0
            ? "No local results. Press Enter for API search."
            : undefined,
      };
    },
  };
};

// ============================================================================
// HOOKS
// ============================================================================

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AdvancedSearchComponent = ({
  apiEndpoint = "https://jsonplaceholder.typicode.com/users",
  debounceMs = 300,
  minQueryLength = 2,
  maxResults = 50,
  onUserSelect,
  defaultStrategy = "balanced",
  rateLimit = 60,
  rateLimitWindow = 60000,
  cacheDuration = 5 * 60 * 1000,
  maxCacheSize = 50,
  showStats = false,
  showStrategySelector = false,
  searchFields = ["name", "email"],
}: SearchComponentProps) => {
  // useState

  // batch 01
  const [showStrategyMenu, setShowStrategyMenu] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>(defaultStrategy);
  // batch 02
  const [apiResult, setApiResult] = useState<ApiResult>({
    isLoading: false,
    error: null,
    results: [],
    isDropdownOpen: false,
  });

  // batch 03
  const [query, setQuery] = useState("");
  const [searchStats, setSearchStats] = useState<SearchStats>({
    apiCalls: 0,
    cacheHits: 0,
    localSearches: 0,
  });

  // ref's
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const strategySelectorRef = useRef<HTMLDivElement | null>(null);
  console.log("🚀 ~ strategySelectorRef:", strategySelectorRef);

  const abortControllerRef = useRef<AbortController | null>(null);
  const recentSearchesRef = useRef<Map<string, User[]>>(new Map());
  const currentStrategyRef = useRef<SearchMode>(searchMode);

  // useEffect's
  useEffect(() => {
    currentStrategyRef.current = searchMode;
  }, [searchMode]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  // useMemo's
  const cache = useMemo(
    () => createSearchCache<User>(cacheDuration, maxCacheSize),
    [cacheDuration, maxCacheSize]
  );

  const rateLimiter = useMemo(
    () => createRateLimiter(rateLimit, rateLimitWindow),
    [rateLimit, rateLimitWindow]
  );

  const strategies = useMemo(
    () => ({
      instant: createInstantSearchStrategy(cache, rateLimiter),
      balanced: createBalancedSearchStrategy(cache, rateLimiter),
      conservative: createConservativeSearchStrategy(cache, rateLimiter),
      manual: createManualSearchStrategy(cache),
    }),
    [cache, rateLimiter]
  );

  const searchStrategyConfigs: SearchStrategy[] = useMemo(
    () => [
      {
        id: "instant",
        name: "Instant Search",
        description: "Fastest results, highest API usage",
        icon: <Zap className="w-4 h-4" />,
        recommendedFor: "Internal apps, high rate limits",
      },
      {
        id: "balanced",
        name: "Balanced Mode",
        description: "Smart caching + API fallback",
        icon: <Smartphone className="w-4 h-4" />,
        recommendedFor: "Most production applications",
      },
      {
        id: "conservative",
        name: "Conservative",
        description: "Maximizes cache, minimizes API calls",
        icon: <Shield className="w-4 h-4" />,
        recommendedFor: "Strict rate limits, large user base",
      },
      {
        id: "manual",
        name: "Manual Search",
        description: "Press Enter to search",
        icon: <Search className="w-4 h-4" />,
        recommendedFor: "Mobile users, limited APIs",
      },
    ],
    []
  );

  //useCallback's
  const buildApiUrl = useCallback(
    (searchQuery: string): string => {
      if (typeof apiEndpoint === "function") {
        return apiEndpoint(searchQuery);
      }
      return `${apiEndpoint}?q=${encodeURIComponent(searchQuery)}`;
    },
    [apiEndpoint]
  );

  const performApiSearch = useCallback(
    async (searchQuery: string): Promise<User[]> => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const url = buildApiUrl(searchQuery);

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: User[] = await response.json();

      const filtered = data
        .filter((user) => {
          const lowerQuery = searchQuery.toLowerCase();
          return searchFields.some((field) => {
            const value = user[field];
            if (typeof value === "string") {
              return value.toLowerCase().includes(lowerQuery);
            }
            if (typeof value === "object" && value !== null) {
              return Object.values(value).some(
                (v) =>
                  typeof v === "string" && v.toLowerCase().includes(lowerQuery)
              );
            }
            return false;
          });
        })
        .slice(0, maxResults);

      return filtered;
    },
    [buildApiUrl, maxResults, searchFields]
  );

  const performLocalSearch = useCallback(
    (searchQuery: string): User[] => {
      const lowerQuery = searchQuery.toLowerCase();
      const resultsSet = new Set<User>();

      for (const users of recentSearchesRef.current.values()) {
        users.forEach((user) => {
          const matches = searchFields.some((field) => {
            const value = user[field];
            if (typeof value === "string") {
              return value.toLowerCase().includes(lowerQuery);
            }
            if (typeof value === "object" && value !== null) {
              return Object.values(value).some(
                (v) =>
                  typeof v === "string" && v.toLowerCase().includes(lowerQuery)
              );
            }
            return false;
          });

          if (matches) {
            resultsSet.add(user);
          }
        });
      }

      return Array.from(resultsSet).slice(0, maxResults);
    },
    [maxResults, searchFields]
  );

  const updateStats = useCallback((source: string) => {
    setSearchStats((prev) => {
      switch (source) {
        case "api":
          return { ...prev, apiCalls: prev.apiCalls + 1 };
        case "cache":
          return { ...prev, cacheHits: prev.cacheHits + 1 };
        case "local":
          return { ...prev, localSearches: prev.localSearches + 1 };
        default:
          return prev;
      }
    });
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string, currentMode: SearchMode): Promise<void> => {
      const trimmedQuery = searchQuery.trim();

      if (!trimmedQuery || trimmedQuery.length < minQueryLength) {
        setApiResult((prev) => ({
          ...prev,
          error: null,
          results: [],
        }));
        return;
      }

      setApiResult((prev) => ({
        ...prev,
        error: null,
        isLoading: true,
      }));

      try {
        const strategy = strategies[currentMode];
        const result = await strategy.execute(
          trimmedQuery,
          performApiSearch,
          performLocalSearch
        );

        if (currentStrategyRef.current !== currentMode) {
          return;
        }

        setApiResult((prev) => ({
          ...prev,
          error: result.error || null,
          results: result.data,
        }));
        updateStats(result.source);

        if (result.data.length > 0) {
          recentSearchesRef.current.set(trimmedQuery, result.data);
          if (recentSearchesRef.current.size > 20) {
            const firstKey = Array.from(recentSearchesRef.current.keys())[0];
            if (firstKey) recentSearchesRef.current.delete(firstKey);
          }
        }

        setApiResult((prev) => ({
          ...prev,
          isDropdownOpen: true,
        }));
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setApiResult((prev) => ({
            ...prev,
            error: "An unexpected error occurred",
          }));
        }
      } finally {
        setApiResult((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    },
    [
      minQueryLength,
      strategies,
      performApiSearch,
      performLocalSearch,
      updateStats,
    ]
  );

  // custome-Hooks
  const debouncedSearch = useDebounce(
    (query: string, mode: SearchMode) => performSearch(query, mode),
    debounceMs
  );
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowStrategyMenu((p) => !p);
  };
  useClickOutside(dropdownRef, () => setShowStrategyMenu(false));

  // Search dropdown
  useClickOutside(dropdownRef, () =>
    setApiResult((prev) => ({ ...prev, isDropdownOpen: false }))
  );
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      setQuery(newQuery);
      setApiResult((prev) => ({
        ...prev,
        error: null,
      }));

      const trimmedQuery = newQuery.trim();

      if (!trimmedQuery) {
        setApiResult((prev) => ({
          ...prev,
          results: [],
          isDropdownOpen: false,
        }));
        return;
      }

      if (searchMode === "manual") {
        if (trimmedQuery.length >= minQueryLength) {
          performSearch(trimmedQuery, searchMode);
        } else {
          setApiResult((prev) => ({
            ...prev,
            results: [],
          }));
        }
        return;
      }

      setApiResult((prev) => ({
        ...prev,
        isLoading: true,
      }));
      debouncedSearch(newQuery, searchMode);
    },
    [searchMode, minQueryLength, performSearch, debouncedSearch]
  );
  const SearchDropdown = React.memo(
    ({
      results,
      error,
      onSelect,
    }: {
      results: User[];
      error?: string;
      onSelect: (user: User) => void;
    }) => {
      if (!results.length && !error) return null;

      return (
        <div className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-40">
          {error && (
            <div className="p-3 text-red-700 bg-red-50 flex items-start gap-2 border-b">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-gray-900 truncate">
                {user.name}
              </div>
              <div className="text-sm text-gray-600 truncate">{user.email}</div>
              <div className="text-xs text-gray-500 truncate">
                {user.company.name}
              </div>
            </button>
          ))}
        </div>
      );
    }
  );

  const handleSelect = useCallback(
    (user: User) => {
      setQuery(user.name);
      setApiResult((prev) => ({
        ...prev,
        setIsDropdownOpen: false,
        setResults: [],
      }));

      onUserSelect?.(user);
    },
    [onUserSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setApiResult((prev) => ({ ...prev, setIsDropdownOpen: false }));

        inputRef.current?.blur();
      } else if (e.key === "Enter") {
        if (searchMode === "manual" && query.trim().length >= minQueryLength) {
          setApiResult((prev) => ({ ...prev, isLoading: false }));
          performApiSearch(query.trim())
            .then((data) => {
              rateLimiter.record();
              cache.set(query.trim(), data);

              setApiResult((prev) => ({
                ...prev,
                results: data,
                error: null,
                isDropdownOpen: true,
              }));
              updateStats("api");
            })
            .catch((error) => {
              if (error.name !== "AbortError") {
                setApiResult((prev) => ({
                  ...prev,
                  error: "Search failed. Please try again.",
                }));
              }
            })
            .finally(() =>
              setApiResult((prev) => ({
                ...prev,
                isLoading: false,
              }))
            );
        } else if (apiResult.results.length > 0) {
          handleSelect(apiResult.results[0]);
        }
      }
    },
    [
      apiResult.results,
      cache,
      handleSelect,
      minQueryLength,
      performApiSearch,
      query,
      rateLimiter,
      searchMode,
      updateStats,
    ]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setApiResult((prev) => ({
      ...prev,
      results: [],
      isLoading: false,
      error: null,
      isDropdownOpen: false,
    }));
    abortControllerRef.current?.abort();
  }, []);

  const handleStrategyChange = useCallback((mode: SearchMode) => {
    abortControllerRef.current?.abort();
    setSearchMode(mode);
    setShowStrategyMenu(false);
    setApiResult((prev) => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  // plain Fn's
  const currentStrategy = searchStrategyConfigs.find(
    (s) => s.id === searchMode
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="relative" ref={strategySelectorRef}>
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors z-50"
        >
          <Settings className="w-4 h-4" />
          {currentStrategy?.name}
        </button>
        {/* done with dropdown-menu */}
        {showStrategyMenu && (
          <div className=" mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
            {searchStrategyConfigs.map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => handleStrategyChange(strategy.id)}
                className={`w-full text-left p-3 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                  searchMode === strategy.id
                    ? "bg-blue-50 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {strategy.icon}
                  <div>
                    <div className="font-medium text-gray-900">
                      {strategy.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {strategy.recommendedFor}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          Adaptive Search Component (Fixed)
        </h1>
        <p className="text-gray-600">
          Professional search with configurable endpoints, cache, and strategies
        </p>
      </div>

      {showStrategySelector && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Search Strategy</h3>
          </div>
          <p className="text-sm text-gray-600">
            {currentStrategy?.description}
          </p>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() =>
              apiResult.results.length > 0 &&
              setApiResult((prev) => ({
                ...prev,
                isDropdownOpen: true,
              }))
            }
            placeholder={
              searchMode === "manual"
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
        </div>

        {apiResult.isLoading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        )}

        {searchMode === "manual" &&
          query.length >= minQueryLength &&
          !apiResult.isLoading && (
            <div className="absolute left-0 right-0 top-full mt-1 text-xs text-gray-500 text-center">
              Press Enter to search API
            </div>
          )}

        {apiResult.isDropdownOpen && (
          <SearchDropdown
            results={apiResult.results}
            error={apiResult.error || undefined}
            onSelect={handleSelect}
          />
        )}

        {showStats && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">
                Strategy Comparison
              </h3>
              <div className="space-y-3 text-sm">
                {searchStrategyConfigs.map((strategy) => (
                  <div
                    key={strategy.id}
                    className={`p-3 rounded border ${
                      searchMode === strategy.id
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="font-medium">{strategy.name}</div>
                    <div className="text-gray-600 text-xs mt-1">
                      {strategy.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">
                Performance Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>API Calls:</span>
                  <span className="font-mono font-semibold">
                    {searchStats.apiCalls}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cache Hits:</span>
                  <span className="font-mono font-semibold">
                    {searchStats.cacheHits}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Local Searches:</span>
                  <span className="font-mono font-semibold">
                    {searchStats.localSearches}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cache Size:</span>
                  <span className="font-mono font-semibold">
                    {cache.size} queries
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit:</span>
                  <span className="font-mono font-semibold">
                    {rateLimiter.remaining()}/{rateLimit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            What's Fixed in This Version
          </h3>
          <ul className="text-sm text-green-700 space-y-1 ml-6 list-disc">
            <li>✅ Configurable API endpoint (string or function)</li>
            <li>✅ Configurable cache size via maxCacheSize prop</li>
            <li>✅ Configurable rate limit window via rateLimitWindow prop</li>
            <li>✅ Flexible search fields configuration</li>
            <li>✅ Strategy switching cancels in-flight requests</li>
            <li>✅ Rate limiter shows remaining requests</li>
            <li>✅ Better z-index management for dropdowns</li>
            <li>✅ Strategy reference tracking prevents race conditions</li>
          </ul>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Example Usage</h3>
          <pre className="text-xs bg-white p-3 rounded border border-blue-200 overflow-x-auto">
            {`// Basic usage
<AdvancedSearchComponent 
  apiEndpoint="https://api.example.com/users"
  onUserSelect={(user) => console.log(user)}
/>

// With custom endpoint function
<AdvancedSearchComponent 
  apiEndpoint={(query) => 
    \`https://api.example.com/search?term=\${query}&limit=20\`
  }
  searchFields={["name", "email"]}
  maxCacheSize={100}
  rateLimitWindow={60000}
  defaultStrategy="conservative"
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdvancedSearchComponent);

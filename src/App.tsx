import DropDown, {
  type SearchOptionValue,
} from "./bank/features/btn-dropdown/DropDown";
import AdvancedSearchComponent from "./searchbar/AdvancedSearchComponent";
import SearchBar from "./bank/features/search-bar/SearchBar";
import { useState } from "react";

const App = () => {
  const [searchMode, setSearchMode] =
    useState<SearchOptionValue>("Balanced Mode");
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          Adaptive Search Component (Fixed)
        </h1>
        <p className="text-gray-600">
          Professional search with configurable endpoints, cache, and strategies
        </p>
      </div>

      <DropDown searchMode={searchMode} setSearchMode={setSearchMode} />
      <SearchBar searchMode={searchMode} />
      <AdvancedSearchComponent />
    </>
  );
};

export default App;

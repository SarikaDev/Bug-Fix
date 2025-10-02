import { useRef, useState, type JSX } from "react";
import { Zap, Shield, Settings, Smartphone } from "lucide-react";
import useClickOutside from "../../hooks/useClickOutside";
const searchOptions = {
  instant: "Instant Search",
  balanced: "Balanced Mode",
  conservative: "Conservative",
  manual: "Manual Entry",
} as const;

type SearchOptionKey = keyof typeof searchOptions;
// "instant" | "balanced" | "conservative" | "manual"

export type SearchOptionValue = (typeof searchOptions)[SearchOptionKey];
// "Instant Search" | "Balanced Mode" | "Conservative" | "Manual Entry"

interface DropdownOption {
  id: SearchOptionKey; // backend identifier
  name: SearchOptionValue; // object key
  description: string; // human-readable label
  icon: JSX.Element; // icons
}

const optionMeta: Record<
  SearchOptionKey,
  { description: string; icon: JSX.Element }
> = {
  instant: {
    description: "Executes the search immediately",
    icon: <Zap className="w-5 h-5 text-blue-500" />,
  },
  balanced: {
    description: "Balances speed with accuracy",
    icon: <Settings className="w-5 h-5 text-green-500" />,
  },
  conservative: {
    description: "Prefers accuracy and safety",
    icon: <Shield className="w-5 h-5 text-orange-500" />,
  },
  manual: {
    description: "User triggers search manually",
    icon: <Smartphone className="w-5 h-5 text-gray-500" />,
  },
};
interface DropDownProps {
  searchMode: SearchOptionValue;
  setSearchMode: React.Dispatch<React.SetStateAction<SearchOptionValue>>;
}
const DropDown = ({ searchMode, setSearchMode }: DropDownProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const handleStrategyChange = (id: SearchOptionValue) => {
    setSearchMode(id);
  };
  const dropdownOptions: DropdownOption[] = (
    Object.entries(searchOptions) as [SearchOptionKey, SearchOptionValue][]
  ).map(([key, value]) => ({
    id: key,
    name: value,
    description: optionMeta[key].description,
    icon: optionMeta[key].icon,
  }));

  const handleToggle = () => {
    setIsDropdownOpen((p) => !p);
  };

  const handleOptions = (name: SearchOptionValue) => {
    setIsDropdownOpen(false);
    handleStrategyChange(name);
  };

  const handleClickOutside = () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
    }
    return;
  };

  useClickOutside(dropRef, handleClickOutside);

  return (
    <>
      <div
        ref={dropRef}
        className=" relative inline-block border-solid border-2 border-amber-300"
      >
        <button
          onClick={handleToggle}
          onTouchStart={handleToggle}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors z-50"
        >
          <Settings className="w-4 h-4" />
          {searchMode}
        </button>
        {isDropdownOpen && (
          <div className="absolute top-1 left-0 z-50 max-w-sm mx-auto mt-5 ">
            <div className="mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
              {dropdownOptions.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => handleOptions(strategy.name)}
                  onTouchStart={() => handleOptions(strategy.name)}
                  className={`w-full text-left p-3 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    searchMode === strategy.name
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
                        {strategy.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DropDown;

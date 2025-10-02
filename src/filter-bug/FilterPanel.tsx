import React, { useState, useContext } from "react";
import { FilterContext, type Filters } from "./FilterContext";

const categories = ["A", "B", "C", "D"]; // Example dropdown options

export const FilterPanel: React.FC = () => {
  const context = useContext(FilterContext);
  if (!context)
    throw new Error("FilterPanel must be used within FilterProvider");

  const { appliedFilters, setAppliedFilters } = context;
  const [localFilters, setLocalFilters] = useState<Filters>(appliedFilters);

  const handleApply = () => setAppliedFilters(localFilters);

  const handleDelete = (key: keyof Filters) => {
    const updated = { ...appliedFilters };
    delete updated[key];
    setAppliedFilters(updated);
    setLocalFilters(updated);
  };

  return (
    <div className="p-4 border-b-2">
      {/* Dropdown for category */}
      <select
        className="border p-2 mr-2"
        value={localFilters.category || ""}
        onChange={(e) =>
          setLocalFilters({ ...localFilters, category: e.target.value })
        }
      >
        <option value="">Select Category</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleApply}
      >
        Apply Filters
      </button>

      <div className="mt-4 flex gap-2 flex-wrap">
        {Object.entries(appliedFilters).map(([key, value]) => (
          <div
            key={key}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full flex items-center gap-1"
          >
            <span>
              {key}: {value}
            </span>
            <button
              className="text-red-500 font-bold"
              onClick={() => handleDelete(key as keyof Filters)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

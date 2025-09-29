import React, { useState, useMemo } from "react";
import { FilterContext, type Filters } from "./FilterContext";

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const defaultFilters: Filters = {
    category: "A",
    priceRange: "$10-$50",
    brand: "Nike",
    color: "Red",
    size: "M",
    rating: "4+",
    material: "Cotton",
    discount: "10%",
    stock: "In Stock",
    origin: "USA",
    weight: "1kg",
    model: "X100",
    warranty: "1 year",
    seller: "Amazon",
  };

  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);

  const value = useMemo(
    () => ({ appliedFilters, setAppliedFilters }),
    [appliedFilters]
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
};

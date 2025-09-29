import { createContext } from "react";
export interface Filters {
  category?: string;
  priceRange?: string;
  brand?: string;
  color?: string;
  size?: string;
  rating?: string;
  material?: string;
  discount?: string;
  stock?: string;
  origin?: string;
  weight?: string;
  model?: string;
  warranty?: string;
  seller?: string;
}

export interface FilterContextType {
  appliedFilters: Filters;
  setAppliedFilters: (f: Filters) => void;
}

export const FilterContext = createContext<FilterContextType | undefined>(
  undefined
);

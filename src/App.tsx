import React from "react";
import { FilterProvider } from "./FilterProvider";
import { FilterPanel } from "./FilterPanel";
import Table from "./Table";

const data = [
  {
    id: 1,
    name: "Item 1",
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
  },
  {
    id: 2,
    name: "Item 2",
    category: "B",
    priceRange: "$20-$60",
    brand: "Adidas",
    color: "Blue",
    size: "L",
    rating: "5",
    material: "Polyester",
    discount: "15%",
    stock: "In Stock",
    origin: "Germany",
    weight: "1.2kg",
    model: "A200",
    warranty: "2 years",
    seller: "Flipkart",
  },
  {
    id: 3,
    name: "Item 3",
    category: "C",
    priceRange: "$15-$40",
    brand: "Puma",
    color: "Green",
    size: "S",
    rating: "3+",
    material: "Cotton",
    discount: "5%",
    stock: "Out of Stock",
    origin: "India",
    weight: "0.8kg",
    model: "P300",
    warranty: "1 year",
    seller: "Amazon",
  },
  {
    id: 4,
    name: "Item 4",
    category: "D",
    priceRange: "$25-$70",
    brand: "Reebok",
    color: "Black",
    size: "XL",
    rating: "4.5",
    material: "Leather",
    discount: "20%",
    stock: "In Stock",
    origin: "USA",
    weight: "1.5kg",
    model: "R400",
    warranty: "2 years",
    seller: "Myntra",
  },
];

const App: React.FC = () => {
  return (
    <FilterProvider>
      <div className="max-w-7xl mx-auto mt-10 border rounded">
        <FilterPanel />
        <Table data={data} />
      </div>
    </FilterProvider>
  );
};

export default App;

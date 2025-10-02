/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext } from "react";
import { FilterContext } from "./FilterContext";

interface Item {
  [key: string]: any; // dynamic keys for all 14+ fields
}

interface TableProps {
  data: Item[];
}

const Table: React.FC<TableProps> = ({ data }) => {
  const context = useContext(FilterContext);
  if (!context) throw new Error("Table must be used within FilterProvider");

  const { appliedFilters } = context;

  // Filter data based on appliedFilters
  const filteredData = data.filter((item) => {
    return Object.entries(appliedFilters).every(([key, value]) => {
      if (!value) return true;
      return item[key] === value;
    });
  });

  console.log("Table rendered");

  if (filteredData.length === 0) return <p className="p-4">No items found.</p>;

  // Dynamically get table headers from first item
  const headers = Object.keys(filteredData[0]);

  return (
    <div className="p-4 overflow-x-auto">
      <table className="border-collapse border w-full text-left">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border px-2 py-1 bg-gray-100">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((item, idx) => (
            <tr key={idx}>
              {headers.map((header) => (
                <td key={header} className="border px-2 py-1">
                  {item[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(Table);

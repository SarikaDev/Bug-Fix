// ReportContext.tsx

import { createContext } from "react";
const defaultContextValue: IReportsContextValue = {
  showFilterModal: false,
  setShowFilterModal: () => {},
  appliedFilters: {},
  setAppliedFilters: () => {},
  selectedPage: 1,
  setSelectedPage: () => {},
  pageSize: 25,
  reportData: {
    items: [],
    pagination: {
      total: 0,
      totalPages: 0,
      page: 1,
      pageSize: 25,
    },
  },
  reportDataLoading: false,
  clientsDataLoading: false,
  clientsData: [],
  isClientsLoading: false,
  skusData: [],
  skuMap: {},
  clientMap: {},
};
export const ReportsContext = createContext<IReportsContextValue | undefined>(
  defaultContextValue
);

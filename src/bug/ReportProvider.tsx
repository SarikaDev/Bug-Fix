import { useMemo } from "react";

// ReportsProvider.tsx
export default  ReportsProvider: React.FC<IReportsProviderProps> = ({ children: React.ReactNode }) => {

  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const stableSetters = useMemo(() => ({
    setAppliedFilters,
    setSelectedPage,
    setShowFilterModal,
  }), []);
  const { data: reportData, isLoading: reportDataLoading } = useQuery({
    queryKey: ["clientBomReport", selectedPage, appliedFilters],
    queryFn: () =>
      APIHandler.getClientBomReport({
        page: selectedPage,
        pageSize,
        ...appliedFilters,
      }),
    select: (resp: IClientBomReportResponse) => resp?.data,
    meta: { toastConfig: { name: "Client BOM Report" } },
  });

  const { isLoading: clientsDataLoading, data: clientsData } = useQuery({
    queryKey: ["clientsData"],
    queryFn: () =>
      APIHandler.getFilteredData({
        q: "",
        sortBy: "clientName",
        sortOrder: "desc",
        page: 1,
        pageSize: 25,
      }),
    select: (data) => data?.data?.items || [],
    meta: { toastConfig: { name: "Client List" } },
  });

  const { isLoading: isClientsLoading, data: skusData } = useQuery({
    queryKey: ["masterBoms"],
    queryFn: () => APIHandler.getAllBoms(),
    select: (data) => data?.data?.items || [],
    meta: { toastConfig: { name: "SKU List" } },
  });

  const skuMap = useMemo(() => {
    const map: Record<string, string> = {};
    skusData?.forEach((item: IMasterBom) => {
      if (item?.skuId && item?.name) {
        map[item.skuId] = item.name;
      }
    });
    return map;
  }, [skusData]); 

const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clientsData?.forEach((client: IClientItem) => {
      if (client?.id && client?.clientName) {
        map[client.id] = client.clientName;
      }
    });
    return map;
  }, [clientsData]);

  const defaultReportData = useMemo(
    () => ({
      items: [],
      pagination: {
        total: 0,
        totalPages: 0,
        page: 1,
        pageSize: 25,
      },
    }),
    []
  );

 const contextValue = useMemo(() => ({
    // State
    showFilterModal,
    appliedFilters,
    selectedPage,
    pageSize,
    
    // Stable setters (already memoized)
    ...stableSetters,
    
    // Data with fallbacks
    reportData: reportData ?? defaultReportData,
    clientsData: clientsData ?? [],
    skusData: skusData ?? [],
    
    // Loading states
    reportDataLoading,
    clientsDataLoading,
    isClientsLoading,
    
    // Memoized maps
    skuMap,
    clientMap,
  }), [
    showFilterModal,
    appliedFilters,
    selectedPage,
    pageSize,
    reportData,
    clientsData,
    skusData,
    reportDataLoading,
    clientsDataLoading,
    isClientsLoading,
    skuMap,
    clientMap,
    stableSetters, 
    defaultReportData, 
  ]);
  return (
    <ReportsContext.Provider value={contextValue}>
      {children}
    </ReportsContext.Provider>
  );
};
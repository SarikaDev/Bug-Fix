// Reports.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useContext,
} from "react";
import { ReportsContext } from "./ReportContext";
import { useReportsUrlParams } from "./ReportUrlUtils";
import ReportsProvider from "./ReportProvider";

const Reports = () => {
  const { t } = useTranslation();
  const [activeFilters, setActiveFilters] = useState<ReportFilters>({});
  const [showLocalFilters, setLocalShowFilter] = useState<boolean>(false);
  const [tagBarData, setTagBarData] = useState<TagBarItem[]>([]);
  const nav = useNavigate();
  const context = useContext(ReportsContext);
  if (!context)
    throw new Error("FilterPanel must be used within FilterProvider");

  const {
    setAppliedFilters,
    selectedPage,
    setSelectedPage,
    reportData,
    reportDataLoading: isLoading,
    skuMap,
    clientMap,
    setShowFilterModal,
  } = context;

  const {
    urlData,
    parsedFilters,
    updateUrlParams,
    resetFilters,
    deleteReportTag,
  } = useReportsUrlParams();

  useEffect(() => {
    setActiveFilters(parsedFilters);
    setAppliedFilters(parsedFilters);

    if (urlData.currentPage !== selectedPage) {
      setSelectedPage(urlData.currentPage);
    }
  }, [
    parsedFilters,
    urlData.currentPage,
    selectedPage,
    setAppliedFilters,
    setSelectedPage,
  ]);

  const computedReportData = useMemo((): ComputedReportData => {
    const items = (reportData?.items || []) as ReportRow[];
    const fallbackTotal = items.length;
    const base = reportData?.pagination ?? {
      total: fallbackTotal,
      page: urlData.currentPage,
      pageSize: context.pageSize,
      totalPages: Math.max(1, Math.ceil(fallbackTotal / context.pageSize)),
    };

    return {
      paginationInfo: base,
      displayItems: items,
    };
  }, [reportData, urlData.currentPage, context.pageSize]);

  useEffect(() => {
    const totalPages = reportData?.pagination?.totalPages;
    if (!totalPages) return;

    const max = Math.max(1, totalPages);
    if (urlData.currentPage > max) {
      updateUrlParams({ ...parsedFilters, page: max });
    }
  }, [
    reportData?.pagination?.totalPages,
    urlData.currentPage,
    updateUrlParams,
    parsedFilters,
  ]);

  const handleResetFilters = useCallback(() => {
    setActiveFilters({});
    setAppliedFilters({});
    resetFilters();
  }, [setAppliedFilters, resetFilters]);

  const tagBarItems = useMemo((): TagBarItem[] => {
    const tags: TagBarItem[] = [];

    if (activeFilters.skuId?.length) {
      activeFilters.skuId.forEach((id) => {
        const display = skuMap?.[id] ?? id;
        tags.push({
          key: `skuId-${id}`,
          text: display,
          tooltip: `${t("adminCenter.reports.table.sku")}: ${display}`,
          actualValue: id,
        });
      });
    }

    if (activeFilters.clientIds?.length) {
      activeFilters.clientIds.forEach((id) => {
        const display = clientMap?.[id] ?? id;
        tags.push({
          key: `clientIds-${id}`,
          text: display,
          tooltip: `${t("adminCenter.reports.table.clientName")}: ${display}`,
          actualValue: id,
        });
      });
    }
    const {
      skuId: _skuId,
      clientIds: _clientIds,
      ...restFilters
    } = activeFilters;

    const arrayFilters = Object.entries(restFilters).reduce(
      (acc, [key, value]) => {
        if (value != null && Array.isArray(value) && value.length > 0) {
          acc[key] = value;
        } else if (value != null && !Array.isArray(value)) {
          acc[key] = [value];
        }
        return acc;
      },
      {} as Record<string, any[]>
    );

    const otherTags = transformFilterKeys(arrayFilters, t);
    return [...tags, ...otherTags];
  }, [activeFilters, t, skuMap, clientMap]);

  useEffect(() => {
    setLocalShowFilter(tagBarItems.length > 0);
    setTagBarData(tagBarItems);
  }, [tagBarItems]);

  const handlePageSelect = useCallback(
    (page: number) => {
      setSelectedPage(page);
      updateUrlParams({ ...parsedFilters, page });
    },
    [parsedFilters, setSelectedPage, updateUrlParams]
  );
  const tableColumns = useMemo(
    (): ColumnDef<ReportRow>[] => [
      {
        header: t`adminCenter.reports.table.sku`!,
        accessorKey: "name",
        enableSorting: true,
        minSize: 250,
      },
      {
        header: t`adminCenter.reports.table.category`,
        accessorKey: "category",
        enableSorting: true,
        maxSize: 10,
        cell: (instance: CellContext<ReportRow, string>) => (
          <Typography>{capitalizeFirstLetter(instance.getValue())}</Typography>
        ),
      },
      {
        header: t`adminCenter.reports.table.type`!,
        accessorKey: "masterBomType",
        enableSorting: true,
        maxSize: 10,
        cell: (instance: CellContext<ReportRow, string>) => (
          <Typography>{capitalizeFirstLetter(instance.getValue())}</Typography>
        ),
      },
      {
        header: t`adminCenter.reports.table.clientName`!,
        accessorKey: "clientId",
        enableSorting: true,
        maxSize: 20,
      },
      {
        header: t`adminCenter.reports.table.employees`!,
        accessorKey: "currentEmployeeCount",
        enableSorting: true,
        maxSize: 8,
      },
      {
        header: t`adminCenter.reports.table.skuStatus`!,
        accessorKey: "status",
        enableSorting: true,
        minSize: 50,
        cell: (instance: CellContext<ReportRow, string>) => (
          <Typography>{capitalizeFirstLetter(instance.getValue())}</Typography>
        ),
      },
      {
        header: t`adminCenter.reports.table.tags`,
        accessorKey: "licenseType",
        enableSorting: true,
        minSize: 10,
        cell: (instance: CellContext<ReportRow, string>) => (
          <TextFieldTags
            tagBarItems={instance.getValue() ? [instance.getValue()] : []}
          />
        ),
      },
      {
        header: t`adminCenter.reports.table.goLiveDate`!,
        accessorKey: "liveAsOf",
        enableSorting: true,
        maxSize: 12,
        sortingFn: (rowA, rowB) => {
          const a = new Date(rowA.original.liveAsOf);
          const b = new Date(rowB.original.liveAsOf);
          return a > b ? 1 : a < b ? -1 : 0;
        },
      },
    ],
    [t]
  );
  if (isLoading) {
    return (
      <VBox
        className="h-[60vh] w-[stretch]"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="2rem" />
      </VBox>
    );
  }
  return (
    <VBox className="border-t-2 border-primary-2">
      <VBox className="border-t-2 border-primary-2">
        <HBox
          className="gap-2 w-[stretch] my-[0.75rem]"
          justifyContent="between"
          alignItems="center"
        >
          <HBox className="gap-2" alignItems="center">
            <Typography
              variant="subtitle-1"
              visible={true}
              className="m-2 py-2"
            >
              {t("adminCenter.reports.tabName")}
            </Typography>
            <Popover
              content={<ReportFilterComponent />}
              trigger="click"
              show={context.showFilterModal}
              setShow={handleFilterModalToggle}
            >
              <Button
                aria-describedby="tooltip"
                role="filter_btn"
                onClick={handleFilterModalToggle}
              >
                <HBox gap="3" alignItems="center">
                  <Filter width="15px" height="15px" strokeWidth="2.1" />
                  <Typography variant="button-small">
                    {t("addFilter")}
                  </Typography>
                </HBox>
              </Button>
            </Popover>
            {showLocalFilters && (
              <Button
                variant="secondary"
                className="reset-btn"
                onClick={handleResetFilters}
              >
                <Typography variant="button-small">{t("reset")}</Typography>
              </Button>
            )}
          </HBox>

          <Pagination
            total={computedReportData.paginationInfo.total}
            page={selectedPage}
            totalPages={computedReportData.paginationInfo.totalPages}
            pageSize={computedReportData.paginationInfo.pageSize}
            onSelect={handlePageSelect}
          />
        </HBox>

        {showLocalFilters && (
          <HBox
            gap="3"
            width="100%"
            alignItems="center"
            className="pb-3"
            role="filtersTagBar"
          >
            <TagBar
              role="filtersTagBar"
              data={tagBarData}
              onDelete={(data: TagBarItem) => {
                const goTo = deleteReportTag(data);
                nav(goTo);
              }}
              className="w-full"
            />
          </HBox>
        )}

        <Container
          role="ReportsTable"
          className="mb-10 ms-0 mx-1 max-h-[calc(100vh-250px)] min-h-[calc(100vh-250px)] overflow-y-auto px-1"
        >
          <Table
            className="w-full"
            key="reports-table"
            selectionMode="none"
            columns={tableColumns}
            data={computedReportData.displayItems}
          />
        </Container>
      </VBox>
    </VBox>
  );
};
const ReportsWithProvider = () => (
  <ReportsProvider>
    <Reports />
  </ReportsProvider>
);

export default ReportsWithProvider;

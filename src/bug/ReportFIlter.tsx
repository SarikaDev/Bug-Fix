import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useContext,
} from "react";
import {
  AmountField,
  Button,
  Combobox,
  DateRangePicker,
  HBox,
  Spinner,
  Typography,
  VBox,
} from "@vp/prime-ui";
import { useTranslation } from "react-i18next";
import {
  BomStatus,
  licenseTypeList,
  masterBomTypes,
  moduleCategories,
} from "../../utils/constants/DropDownLists";
import sortDropdownItemsByText from "@utils/sortDropdown";
import { useReports } from "../../utils/ReportsContextProvider";
import type { ChangeEvent } from "react";
import { ComboboxItem } from "@vp/prime-ui/dist/components/Combobox/Combobox.types";
import { DateRangePickerProps } from "@vp/prime-ui/dist/components/DateRangePicker/DateRangePicker.types";
import {
  ReportFilters,
  ValidationErrors,
} from "@interfaces/IReportFilterComponent";
import {
  formatDateToMMDDYYYY,
  formatMMDDYYYYToYYYYMMDD,
} from "@utils/commonUtils";
import { useReportsUrlParams } from "@utils/reportsUrlUtils";
import { ReportsContext } from "./ReportContext";

type DateRangeValue = NonNullable<DateRangePickerProps["onChange"]> extends (
  date: infer D
) => void
  ? D
  : never;

const ReportFilterComponent: React.FC = () => {
  const { t } = useTranslation();
  const { updateUrlParams } = useReportsUrlParams();

  const context = useContext(ReportsContext);
  if (!context)
    throw new Error("FilterPanel must be used within FilterProvider");

  const {
    appliedFilters,
    setShowFilterModal,
    clientsData,
    clientsDataLoading: isClientsLoading,
    skusData: skuItems,
    isClientsLoading: isSkusLoading,
    setSelectedPage,
  } = context;

  const [filterOverrides, setFilterOverrides] = useState<
    Partial<ReportFilters>
  >({});

  const draftFilters = useMemo(
    (): ReportFilters => ({
      ...appliedFilters,
      ...filterOverrides,
    }),
    [appliedFilters, filterOverrides]
  );

  const [minEmployees, setMinEmployees] = useState<string>(
    () => appliedFilters.employeesMin?.toString() || ""
  );
  const [maxEmployees, setMaxEmployees] = useState<string>(
    () => appliedFilters.employeesMax?.toString() || ""
  );

  const [goLiveStartDate, setGoLiveStartDate] = useState<string>(() =>
    formatMMDDYYYYToYYYYMMDD(appliedFilters.goLiveStartDate || "")
  );
  const [goLiveEndDate, setGoLiveEndDate] = useState<string>(() =>
    formatMMDDYYYYToYYYYMMDD(appliedFilters.goLiveEndDate || "")
  );

  const parseEmployeeCount = useCallback((value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, []);

  const validateDropdownSelection = useCallback(
    (selectedValues: string[], availableKeys: string[]): boolean => {
      if (!selectedValues?.length || !availableKeys?.length) return true;

      return selectedValues.every((value) => availableKeys.includes(value));
    },
    []
  );

  const skuDropdownItems = useMemo(
    (): ComboboxItem[] =>
      sortDropdownItemsByText(
        skuItems?.map((item) => ({
          text: item.name,
          key: item.skuId,
        })) || []
      ),
    [skuItems]
  );

  const clientDropdownItems = useMemo(
    (): ComboboxItem[] =>
      sortDropdownItemsByText(
        clientsData?.map((client) => ({
          key: client.id,
          text: client.clientName,
        })) || []
      ),
    [clientsData]
  );

  const skuDropdownKeys = useMemo(
    () => skuDropdownItems.map((item) => item.key),
    [skuDropdownItems]
  );

  const clientDropdownKeys = useMemo(
    () => clientDropdownItems.map((item) => item.key),
    [clientDropdownItems]
  );

  const selectedSkuIds = useMemo(
    () => draftFilters.skuId || [],
    [draftFilters.skuId]
  );
  const selectedClientIds = useMemo(
    () => draftFilters.clientIds || [],
    [draftFilters.clientIds]
  );

  const getValidationErrors = (): ValidationErrors => {
    const minEmployeesValue = parseEmployeeCount(minEmployees);
    const maxEmployeesValue = parseEmployeeCount(maxEmployees);

    const minEmployeesError =
      minEmployees !== "" &&
      (minEmployeesValue === null || minEmployeesValue <= 0);

    const maxEmployeesError =
      maxEmployees !== "" &&
      (maxEmployeesValue === null || maxEmployeesValue <= 0);

    const employeeRangeError = Boolean(
      minEmployeesValue &&
        maxEmployeesValue &&
        minEmployeesValue > 0 &&
        maxEmployeesValue > 0 &&
        maxEmployeesValue < minEmployeesValue
    );

    const dateRangeError = Boolean(
      goLiveStartDate &&
        goLiveEndDate &&
        new Date(goLiveStartDate) > new Date(goLiveEndDate)
    );

    const invalidSelectionsError = Boolean(
      !validateDropdownSelection(selectedSkuIds, skuDropdownKeys) ||
        !validateDropdownSelection(selectedClientIds, clientDropdownKeys)
    );

    return {
      minEmployees: minEmployeesError,
      maxEmployees: maxEmployeesError,
      employeeRange: employeeRangeError,
      dateRange: dateRangeError,
      invalidSelections: invalidSelectionsError,
    };
  };

  const validationErrors = getValidationErrors();

  const hasValidationErrors = Object.values(validationErrors).some(Boolean);

  const handleFilterChange = useCallback(
    <T extends keyof ReportFilters>(filterName: T, value: ReportFilters[T]) => {
      setFilterOverrides((prev) => ({
        ...prev,
        [filterName]: value,
      }));
    },
    []
  );

  const handleEmployeeFieldChange =
    (field: "min" | "max") => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (field === "min") {
        setMinEmployees(value);
      } else {
        setMaxEmployees(value);
      }
    };

  const handleDateRangeChange = (range: DateRangeValue) => {
    setGoLiveStartDate(range.start ? range.start.substring(0, 10) : "");
    setGoLiveEndDate(range.end ? range.end.substring(0, 10) : "");
  };

  const resetToAppliedFilters = useCallback(() => {
    setFilterOverrides({});
    setMinEmployees(appliedFilters.employeesMin?.toString() || "");
    setMaxEmployees(appliedFilters.employeesMax?.toString() || "");
    setGoLiveStartDate(
      formatMMDDYYYYToYYYYMMDD(appliedFilters.goLiveStartDate || "")
    );
    setGoLiveEndDate(
      formatMMDDYYYYToYYYYMMDD(appliedFilters.goLiveEndDate || "")
    );
  }, [appliedFilters]);

  const handleClose = useCallback(() => {
    resetToAppliedFilters();
    setShowFilterModal(false);
  }, [setShowFilterModal, resetToAppliedFilters]);

  useEffect(() => {
    resetToAppliedFilters();
  }, [resetToAppliedFilters]);

  const buildFormattedFilters = useCallback((): ReportFilters => {
    const formattedFilters: ReportFilters = { ...draftFilters };

    const minCount = parseEmployeeCount(minEmployees);
    const maxCount = parseEmployeeCount(maxEmployees);

    if (minCount !== null) {
      formattedFilters.employeesMin = minCount;
    }

    if (maxCount !== null) {
      formattedFilters.employeesMax = maxCount;
    }

    if (goLiveStartDate) {
      formattedFilters.goLiveStartDate = formatDateToMMDDYYYY(goLiveStartDate);
    }

    if (goLiveEndDate) {
      formattedFilters.goLiveEndDate = formatDateToMMDDYYYY(goLiveEndDate);
    }

    return formattedFilters;
  }, [
    draftFilters,
    minEmployees,
    maxEmployees,
    goLiveStartDate,
    goLiveEndDate,
    parseEmployeeCount,
  ]);

  const handleSaveAndApply = useCallback(() => {
    const formattedFilters = buildFormattedFilters();
    const urlParams = {
      page: 1,
      ...formattedFilters,
    };
    setShowFilterModal(false);
    updateUrlParams(urlParams);
    setSelectedPage(1);
  }, [
    buildFormattedFilters,
    setSelectedPage,
    setShowFilterModal,
    updateUrlParams,
  ]);

  const renderLoadingState = () => (
    <VBox
      className="h-[50vh] w-[62vh]"
      alignItems="center"
      justifyContent="center"
    >
      <Spinner size="2rem" />
    </VBox>
  );

  const renderEmployeeRangeFilter = () => (
    <VBox>
      <Typography level="h1" variant="small-3" className="mb-2">
        {t("adminCenter.reports.table.employees")}
      </Typography>
      <HBox className="gap-2" alignItems="center">
        <VBox>
          <HBox alignItems="center">
            <Typography level="p" variant="small-3" className="mr-2 w-5">
              {t("Min")}:
            </Typography>
            <AmountField
              role="minEmployees"
              mode="free"
              value={minEmployees}
              onChange={handleEmployeeFieldChange("min")}
              width="75px"
              placeholder={t("Count")}
              size={5}
            />
          </HBox>
        </VBox>
        <VBox>
          <HBox alignItems="center">
            <Typography level="p" variant="small-3" className="mr-2 w-5">
              {t("Max")}:
            </Typography>
            <AmountField
              mode="free"
              value={maxEmployees}
              onChange={handleEmployeeFieldChange("max")}
              width="75px"
              placeholder={t("Count")}
              size={5}
            />
          </HBox>
        </VBox>
      </HBox>
    </VBox>
  );

  const renderValidationErrors = useMemo(
    () => (
      <>
        {validationErrors.minEmployees && (
          <Typography color="red-100" variant="small-2">
            {`* ${t("validationErrors")}: ${t(
              "adminCenter.reports.table.employees"
            )} ${t("Min")} must be greater than 0`}
          </Typography>
        )}
        {validationErrors.maxEmployees && (
          <Typography color="red-100" variant="small-2">
            {`* ${t("validationErrors")}: ${t(
              "adminCenter.reports.table.employees"
            )} ${t("Max")} must be greater than 0`}
          </Typography>
        )}
        {validationErrors.employeeRange && (
          <Typography color="red-100" variant="small-2">
            {`* ${t("validationErrors")}: ${t("Max")} ${t(
              "adminCenter.reports.table.employees"
            )} must be greater than ${t("Min")}`}
          </Typography>
        )}
        {validationErrors.dateRange && (
          <Typography color="red-100" variant="small-2">
            {`* ${t("validationErrors")}: ${t(
              "adminCenter.reports.goLiveDateRangeError"
            )}`}
          </Typography>
        )}
        {validationErrors.invalidSelections && (
          <Typography color="red-100" variant="small-2">
            {`* ${t(
              "validationErrors"
            )}: Invalid selections detected. Please check your dropdown choices.`}
          </Typography>
        )}
      </>
    ),
    [validationErrors, t]
  );

  const renderActionButtons = useMemo(
    () => (
      <HBox
        justifyContent="end"
        className="px-6 pt-4 border-t border-primary-10"
      >
        <Button
          size="small"
          variant="secondary"
          className="focus:bg-transparent"
          onClick={handleClose}
          role="reset-filter"
        >
          <Typography variant="button-small">{t("cancel")}</Typography>
        </Button>
        <Button
          size="small"
          variant="primary"
          className="ml-5"
          onClick={handleSaveAndApply}
          disabled={hasValidationErrors}
          role="saveAndApply"
        >
          <Typography variant="button-small">{t("saveApply")}</Typography>
        </Button>
      </HBox>
    ),
    [handleClose, handleSaveAndApply, hasValidationErrors, t]
  );

  return (
    <VBox
      gap="5"
      className="w-full max-w-[800px] p-5"
      role="filter_dialog"
      aria-label={t("filters")}
    >
      {isClientsLoading || isSkusLoading ? (
        renderLoadingState()
      ) : (
        <>
          <HBox gap="5">
            <Combobox
              label={t("adminCenter.reports.table.sku")}
              multiple
              items={skuDropdownItems}
              selected={draftFilters.skuId || []}
              onChange={(items) =>
                handleFilterChange("skuId", items?.map((i) => i.key) || [])
              }
              placeholder={t("inputField.placeholder.selectOption")}
              showSelectAll
            />
            <Combobox
              label={t("adminCenter.reports.table.category")}
              multiple
              items={sortDropdownItemsByText(moduleCategories)}
              selected={draftFilters.category || []}
              onChange={(items) =>
                handleFilterChange("category", items?.map((i) => i.key) || [])
              }
              placeholder={t("inputField.placeholder.selectOption")}
              showSelectAll
            />
          </HBox>
          <HBox gap="5">
            <Combobox
              label={t("adminCenter.reports.table.type")}
              multiple
              items={sortDropdownItemsByText(masterBomTypes)}
              selected={draftFilters.type || []}
              onChange={(items) =>
                handleFilterChange("type", items?.map((i) => i.key) || [])
              }
              placeholder={t("inputField.placeholder.selectOption")}
              showSelectAll
            />
            <Combobox
              label={t("adminCenter.reports.table.clientName")}
              multiple
              items={clientDropdownItems}
              selected={draftFilters.clientIds || []}
              onChange={(items) =>
                handleFilterChange("clientIds", items?.map((i) => i.key) || [])
              }
              placeholder={t("inputField.placeholder.selectOption")}
              showSelectAll
            />
          </HBox>
          <HBox gap="5">
            {renderEmployeeRangeFilter()}
            <Combobox
              label={t("adminCenter.reports.table.skuStatus")}
              multiple={false}
              items={sortDropdownItemsByText(BomStatus)}
              selected={draftFilters.status || ""}
              onChange={(item) =>
                handleFilterChange("status", item?.key || undefined)
              }
              placeholder={t("inputField.placeholder.selectOption")}
            />
          </HBox>
          <HBox gap="5">
            <Combobox
              label={t("adminCenter.reports.table.tags")}
              multiple
              items={sortDropdownItemsByText(licenseTypeList)}
              selected={draftFilters.tags || []}
              onChange={(items) =>
                handleFilterChange("tags", items?.map((i) => i.key) || [])
              }
              placeholder={t("inputField.placeholder.selectOption")}
              showSelectAll
            />
            <VBox>
              <DateRangePicker
                label={t("adminCenter.reports.table.goLiveDate")}
                type="datetime"
                value={{
                  start: goLiveStartDate || "",
                  end: goLiveEndDate || "",
                }}
                onChange={handleDateRangeChange}
              />
            </VBox>
          </HBox>

          {renderValidationErrors}
          {renderActionButtons}
        </>
      )}
    </VBox>
  );
};

export default ReportFilterComponent;

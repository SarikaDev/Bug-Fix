import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ReportFilters } from "@interfaces/IReportFilterComponent";
import { ReportsUrlParams } from "@interfaces/IClientBomReport";
import { validateFilterKeyPair } from "./filterUtils.tsx";
import {
  REPORTS_FILTER_PARAM_KEYS,
  REPORTS_ARRAY_FILTER_KEYS,
  ALL_REPORTS_FILTER_PARAMS,
} from "./constants/ReportsConstants";

export const useReportsUrlParams = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const urlData = useMemo(() => {
    const search = location.search || location.hash.split("?")[1] || "";
    const params = new URLSearchParams(search);
    const pageFromUrl = Number(params.get("page") || "1");
    const currentPage =
      Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;

    return { search, params, currentPage };
  }, [location.search, location.hash]);

  const parsedFilters = useMemo((): ReportFilters => {
    const { params } = urlData;
    const filters: ReportFilters = {};

    const getParamValues = (paramName: string): string[] => {
      return params.getAll(paramName).filter(Boolean);
    };

    REPORTS_ARRAY_FILTER_KEYS.forEach((key) => {
      const values = getParamValues(key);
      if (values.length > 0) {
        (filters as any)[key] = values;
      }
    });

    const numericFilters = ["employeesMin", "employeesMax"] as const;
    numericFilters.forEach((key) => {
      const value = params.get(key);
      if (value) {
        const numVal = Number(value);
        if (!isNaN(numVal)) {
          (filters as any)[key] = numVal;
        }
      }
    });

    const stringFilters = [
      "status",
      "goLiveStartDate",
      "goLiveEndDate",
      "page",
    ] as const;
    stringFilters.forEach((key) => {
      const value = params.get(key);
      if (value) {
        (filters as any)[key] = value;
      }
    });

    return filters;
  }, [urlData]);

  const updateUrlParams = useCallback(
    (params: ReportsUrlParams) => {
      const urlParams = new URLSearchParams(location.search);

      ALL_REPORTS_FILTER_PARAMS.forEach((param) => {
        urlParams.delete(param);
      });

      if (params.page) {
        urlParams.set("page", String(params.page));
      }
      REPORTS_ARRAY_FILTER_KEYS.forEach((param) => {
        const values = params[param] as string[] | undefined;
        if (values?.length) {
          const validatedPair = validateFilterKeyPair(
            [param, values.join(",")],
            REPORTS_FILTER_PARAM_KEYS
          );
          if (validatedPair) {
            const [key, validatedValues] = validatedPair;
            validatedValues.forEach((value) => {
              urlParams.append(key, value);
            });
          }
        }
      });

      const singleValueParams = {
        status: params.status,
        employeesMin: params.employeesMin?.toString(),
        employeesMax: params.employeesMax?.toString(),
        goLiveStartDate: params.goLiveStartDate,
        goLiveEndDate: params.goLiveEndDate,
      };

      Object.entries(singleValueParams).forEach(([key, value]) => {
        if (value) {
          const validatedPair = validateFilterKeyPair(
            [key, value],
            REPORTS_FILTER_PARAM_KEYS
          );
          if (validatedPair) {
            urlParams.set(key, value);
          }
        }
      });
      const newURL = `#/adminCenter/reports?${urlParams.toString()}`;

      window.location.hash = newURL;
    },
    [location.search]
  );

  const resetFilters = useCallback(() => {
    navigate({ search: "page=1" }, { replace: true });
  }, [navigate]);

  const deleteReportTag = useCallback(
    (tagData: { key: string; text: string; actualValue?: string }) => {
      const currentFilters = parsedFilters;
      const newFilters = { ...currentFilters };

      const keyParts = tagData.key.split("-");
      const filterType = keyParts[0] as keyof ReportFilters;
      const currentValue = newFilters[filterType];

      if (tagData.actualValue) {
        if (Array.isArray(currentValue)) {
          const filteredArray = currentValue.filter(
            (id) => id !== tagData.actualValue
          );
          if (filteredArray.length === 0) {
            delete newFilters[filterType];
          } else {
            (newFilters as any)[filterType] = filteredArray;
          }
        }
      } else {
        if (Array.isArray(currentValue)) {
          const filteredArray = currentValue.filter(
            (val) => val !== tagData.text
          );
          if (filteredArray.length === 0) {
            delete newFilters[filterType];
          } else {
            (newFilters as any)[filterType] = filteredArray;
          }
        } else {
          delete newFilters[filterType];
        }
      }

      const params = new URLSearchParams();

      REPORTS_ARRAY_FILTER_KEYS.forEach((key) => {
        const values = newFilters[key];
        if (values?.length) {
          values.forEach((value) => params.append(key, value));
        }
      });

      const singleValueFilters = {
        status: newFilters.status,
        employeesMin: newFilters.employeesMin?.toString(),
        employeesMax: newFilters.employeesMax?.toString(),
        goLiveStartDate: newFilters.goLiveStartDate,
        goLiveEndDate: newFilters.goLiveEndDate,
      };

      Object.entries(singleValueFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, value);
        }
      });

      params.set("page", "1");

      return `/adminCenter/reports?${params.toString()}`;
    },
    [parsedFilters]
  );

  return {
    urlData,
    parsedFilters,
    updateUrlParams,
    resetFilters,
    deleteReportTag,
  };
};

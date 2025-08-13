import { useMemo, useCallback, useState } from "react";
import type { FilterFn } from "@tanstack/react-table";

/**
 * Advanced Filtering Hook
 * Implements 2025 best practices for React table filtering
 * Supports multi-column search, regex, and complex filter rules
 * Agent 14: Advanced Filtering & Search
 */

interface FilterRule {
  id: string;
  column: string;
  operator:
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "regex"
    | "greaterThan"
    | "lessThan"
    | "between"
    | "in"
    | "notIn";
  value: string | string[] | { min: string; max: string };
  enabled: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  rules: FilterRule[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UseAdvancedFilteringOptions {
  initialPresets?: FilterPreset[];
  storageKey?: string; // For persisting presets in localStorage
  debounceMs?: number; // For debouncing filter changes
}

export const useAdvancedFiltering = <TData extends Record<string, any>>(
  options: UseAdvancedFilteringOptions = {},
) => {
  const {
    initialPresets = [],
    storageKey = "emailDashboard_filterPresets",
    debounceMs = 300,
  } = options;

  // State management
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : initialPresets;
      } catch {
        return initialPresets;
      }
    }
    return initialPresets;
  });

  // Persist presets to localStorage
  const savePresetsToStorage = useCallback(
    (newPresets: FilterPreset[]) => {
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(newPresets));
        } catch (error) {
          console.warn("Failed to save filter presets to localStorage:", error);
        }
      }
    },
    [storageKey],
  );

  // Multi-column global filter function
  const globalFilterFn: FilterFn<TData> = useCallback(
    (row, columnId, filterValue) => {
      if (!filterValue) return true;

      const searchValue = String(filterValue).toLowerCase();
      const searchableContent = Object.values(row.original)
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      // Support for multiple search terms with AND logic
      const searchTerms = searchValue
        .split(/\s+/)
        .filter((term) => term.length > 0);
      return searchTerms.every((term) => searchableContent.includes(term));
    },
    [],
  );

  // Advanced rule-based filter function
  const advancedFilterFn: FilterFn<TData> = useCallback(
    (row, columnId, filterValue) => {
      const rules = filterValue as FilterRule[];
      if (!rules || rules.length === 0) return true;

      // All enabled rules must pass (AND logic)
      return rules.every((rule) => {
        if (!rule.enabled || !rule.value) return true;

        const cellValue = row.getValue(rule.column);
        const stringValue = String(cellValue || "").toLowerCase();

        switch (rule.operator) {
          case "contains":
            return stringValue.includes(String(rule.value).toLowerCase());

          case "equals":
            return stringValue === String(rule.value).toLowerCase();

          case "startsWith":
            return stringValue.startsWith(String(rule.value).toLowerCase());

          case "endsWith":
            return stringValue.endsWith(String(rule.value).toLowerCase());

          case "regex":
            try {
              const regex = new RegExp(String(rule.value), "i");
              return regex.test(stringValue);
            } catch {
              return true; // Invalid regex shouldn't break filtering
            }

          case "greaterThan": {
            const gtValue = parseFloat(String(rule.value));
            const gtCellValue = parseFloat(String(cellValue));
            return (
              !isNaN(gtValue) && !isNaN(gtCellValue) && gtCellValue > gtValue
            );
          }

          case "lessThan": {
            const ltValue = parseFloat(String(rule.value));
            const ltCellValue = parseFloat(String(cellValue));
            return (
              !isNaN(ltValue) && !isNaN(ltCellValue) && ltCellValue < ltValue
            );
          }

          case "between":
            if (
              typeof rule.value === "object" &&
              "min" in rule.value &&
              "max" in rule.value
            ) {
              const minValue = parseFloat(rule.value.min);
              const maxValue = parseFloat(rule.value.max);
              const betweenCellValue = parseFloat(String(cellValue));
              return (
                !isNaN(minValue) &&
                !isNaN(maxValue) &&
                !isNaN(betweenCellValue) &&
                betweenCellValue >= minValue &&
                betweenCellValue <= maxValue
              );
            }
            return true;

          case "in":
            if (Array.isArray(rule.value)) {
              return rule.value.some(
                (val) =>
                  String(cellValue).toLowerCase() === String(val).toLowerCase(),
              );
            }
            return true;

          case "notIn":
            if (Array.isArray(rule.value)) {
              return !rule.value.some(
                (val) =>
                  String(cellValue).toLowerCase() === String(val).toLowerCase(),
              );
            }
            return true;

          default:
            return true;
        }
      });
    },
    [],
  );

  // Fuzzy search function (enhanced version of default fuzzy filter)
  const fuzzyFilterFn: FilterFn<TData> = useCallback(
    (row, columnId, filterValue) => {
      if (!filterValue) return true;

      const itemValue = row.getValue(columnId);
      const searchValue = String(filterValue).toLowerCase();
      const itemString = String(itemValue || "").toLowerCase();

      // Exact match gets highest priority
      if (itemString === searchValue) return true;

      // Contains match
      if (itemString.includes(searchValue)) return true;

      // Fuzzy matching for typos (simple Levenshtein-like approach)
      if (searchValue.length > 2) {
        const words = itemString.split(/\s+/);
        return words.some((word) => {
          if (word.includes(searchValue)) return true;

          // Simple fuzzy matching - allow 1 character difference for words > 3 chars
          if (word.length > 3 && searchValue.length > 3) {
            let differences = 0;
            const minLength = Math.min(word.length, searchValue.length);

            for (let i = 0; i < minLength; i++) {
              if (word[i] !== searchValue[i]) differences++;
              if (differences > 1) break;
            }

            return (
              differences <= 1 &&
              Math.abs(word.length - searchValue.length) <= 1
            );
          }

          return false;
        });
      }

      return false;
    },
    [],
  );

  // Filter rule management
  const addFilterRule = useCallback((rule: Omit<FilterRule, "id">) => {
    const newRule: FilterRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setFilterRules((prev) => [...prev, newRule]);
  }, []);

  const updateFilterRule = useCallback(
    (ruleId: string, updates: Partial<FilterRule>) => {
      setFilterRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId ? { ...rule, ...updates } : rule,
        ),
      );
    },
    [],
  );

  const removeFilterRule = useCallback((ruleId: string) => {
    setFilterRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterRules([]);
    setGlobalFilter("");
  }, []);

  // Preset management
  const savePreset = useCallback(
    (preset: Omit<FilterPreset, "id" | "createdAt" | "updatedAt">) => {
      const newPreset: FilterPreset = {
        ...preset,
        id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
    },
    [presets, savePresetsToStorage],
  );

  const loadPreset = useCallback((preset: FilterPreset) => {
    setFilterRules(preset.rules);
  }, []);

  const deletePreset = useCallback(
    (presetId: string) => {
      const updatedPresets = presets.filter((preset) => preset.id !== presetId);
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
    },
    [presets, savePresetsToStorage],
  );

  const updatePreset = useCallback(
    (
      presetId: string,
      updates: Partial<Omit<FilterPreset, "id" | "createdAt">>,
    ) => {
      const updatedPresets = presets.map((preset) =>
        preset.id === presetId
          ? { ...preset, ...updates, updatedAt: new Date().toISOString() }
          : preset,
      );
      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
    },
    [presets, savePresetsToStorage],
  );

  // Column filter state for TanStack Table
  const columnFilters = useMemo(() => {
    const filters: Array<{ id: string; value: any }> = [];

    // Add global filter
    if (globalFilter) {
      filters.push({ id: "global", value: globalFilter });
    }

    // Add advanced rules filter
    if (filterRules.length > 0) {
      filters.push({ id: "advanced", value: filterRules });
    }

    return filters;
  }, [globalFilter, filterRules]);

  // Filter functions map for TanStack Table
  const filterFns = useMemo(
    () => ({
      global: globalFilterFn,
      advanced: advancedFilterFn,
      fuzzy: fuzzyFilterFn,
    }),
    [globalFilterFn, advancedFilterFn, fuzzyFilterFn],
  );

  // Filter statistics
  const filterStats = useMemo(() => {
    const activeRules = filterRules.filter(
      (rule) => rule.enabled && rule.value,
    );
    const totalFilters = activeRules.length + (globalFilter ? 1 : 0);

    return {
      totalFilters,
      activeRules: activeRules.length,
      hasGlobalFilter: Boolean(globalFilter),
      hasAdvancedFilters: activeRules.length > 0,
      presetCount: presets.length,
    };
  }, [filterRules, globalFilter, presets]);

  // Export current filter state
  const exportFilterState = useCallback(() => {
    return {
      filterRules: filterRules.filter((rule) => rule.enabled),
      globalFilter,
      timestamp: new Date().toISOString(),
    };
  }, [filterRules, globalFilter]);

  // Import filter state
  const importFilterState = useCallback(
    (state: { filterRules: FilterRule[]; globalFilter: string }) => {
      setFilterRules(state.filterRules || []);
      setGlobalFilter(state.globalFilter || "");
    },
    [],
  );

  return {
    // State
    filterRules,
    globalFilter,
    presets,
    columnFilters,
    filterFns,
    filterStats,

    // Filter rule management
    addFilterRule,
    updateFilterRule,
    removeFilterRule,
    clearAllFilters,
    setFilterRules,
    setGlobalFilter,

    // Preset management
    savePreset,
    loadPreset,
    deletePreset,
    updatePreset,

    // Export/Import
    exportFilterState,
    importFilterState,

    // Filter functions (for direct use)
    globalFilterFn,
    advancedFilterFn,
    fuzzyFilterFn,
  };
};

export type { FilterRule, FilterPreset };

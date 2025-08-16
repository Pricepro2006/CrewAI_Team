import React, { useState, useCallback, useMemo } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Filter,
  Calendar,
  Settings,
  Loader,
} from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Data Export Manager Component
 * Implements 2025 best practices for CSV/Excel export and report generation
 * Agent 16: Export & Reporting
 */

export interface ExportColumn {
  id: string;
  label: string;
  field: string;
  type: "text" | "number" | "date" | "boolean" | "currency" | "status";
  format?: (value: any) => string;
  width?: number;
  included: boolean;
}

export interface ExportFilter {
  id: string;
  label: string;
  field: string;
  operator:
    | "equals"
    | "contains"
    | "greaterThan"
    | "lessThan"
    | "between"
    | "in";
  value: any;
  enabled: boolean;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  columns: ExportColumn[];
  filters: ExportFilter[];
  format: "csv" | "xlsx" | "pdf";
  options: {
    includeHeaders: boolean;
    includeFilters: boolean;
    includeMetadata: boolean;
    dateFormat: string;
    currencyFormat: string;
    filename?: string;
  };
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
}

interface DataExportManagerProps {
  data: any[];
  columns: ExportColumn[];
  onExport: (exportData: {
    data: any[];
    columns: ExportColumn[];
    format: "csv" | "xlsx" | "pdf";
    filename: string;
    options: any;
  }) => Promise<void>;
  templates?: ExportTemplate[];
  onTemplateSave?: (
    template: Omit<ExportTemplate, "id" | "createdAt" | "updatedAt">,
  ) => void;
  onTemplateLoad?: (template: ExportTemplate) => void;
  onTemplateDelete?: (templateId: string) => void;
  defaultFilename?: string;
  className?: string;
}

export const DataExportManager: React.FC<DataExportManagerProps> = ({
  data,
  columns: initialColumns,
  onExport,
  templates = [],
  onTemplateSave,
  onTemplateLoad,
  onTemplateDelete,
  defaultFilename = "export",
  className = "",
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">(
    "xlsx",
  );
  const [columns, setColumns] = useState<ExportColumn[]>(initialColumns);
  const [filters, setFilters] = useState<ExportFilter[]>([]);
  const [filename, setFilename] = useState(defaultFilename);
  const [isExporting, setIsExporting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Export options
  const [exportOptions, setExportOptions] = useState({
    includeHeaders: true,
    includeFilters: false,
    includeMetadata: true,
    dateFormat: "YYYY-MM-DD",
    currencyFormat: "USD",
    sheetName: "Export Data",
  });

  // Template management
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Filter data based on active filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    filters
      .filter((filter: any) => filter.enabled)
      .forEach((filter: any) => {
        filtered = filtered?.filter((item: any) => {
          const value = item[filter.field];
          const filterValue = filter?.value;

          switch (filter.operator) {
            case "equals": {
              return value === filterValue;
            }
            case "contains": {
              return String(value || "")
                .toLowerCase()
                .includes(String(filterValue).toLowerCase());
            }
            case "greaterThan": {
              return Number(value) > Number(filterValue);
            }
            case "lessThan": {
              return Number(value) < Number(filterValue);
            }
            case "between": {
              return (
                Number(value) >= Number(filterValue.min) &&
                Number(value) <= Number(filterValue.max)
              );
            }
            case "in": {
              return Array.isArray(filterValue) && filterValue.includes(value);
            }
            default:
              return true;
          }
        });
      });

    return filtered;
  }, [data, filters]);

  // Get included columns
  const includedColumns = useMemo(() => {
    return columns?.filter((col: any) => col.included);
  }, [columns]);

  // Generate filename with timestamp
  const generateFilename = useCallback(
    (format: string) => {
      const timestamp = new Date().toISOString().split("T")[0];
      const baseName = filename || defaultFilename;
      return `${baseName}_${timestamp}.${format}`;
    },
    [filename, defaultFilename],
  );

  // Format cell value based on column type
  const formatCellValue = useCallback((value: any, column: ExportColumn) => {
    if (value === null || value === undefined) return "";

    if (column.format) {
      return column.format(value);
    }

    switch (column.type) {
      case "date": {
        const date = new Date(value);
        return date.toLocaleDateString();
      }
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(value));
      case "number":
        return Number(value).toLocaleString();
      case "boolean":
        return value ? "Yes" : "No";
      default:
        return String(value);
    }
  }, []);

  // Prepare export data
  const prepareExportData = useCallback(() => {
    const exportData = filteredData?.map((item: any) => {
      const row: Record<string, any> = {};
      includedColumns.forEach((column: any) => {
        row[column.label] = formatCellValue(item[column.field], column);
      });
      return row;
    });

    return exportData;
  }, [filteredData, includedColumns, formatCellValue]);

  // Export to CSV
  const exportToCSV = useCallback(async () => {
    const exportData = prepareExportData();

    if (exportData?.length || 0 === 0) {
      alert("No data to export");
      return;
    }

    try {
      // Create CSV content
      const headers = includedColumns?.map((col: any) => col.label);
      const csvContent = [
        exportOptions.includeHeaders ? headers.join(",") : null,
        ...exportData?.map((row: any) =>
          headers
            .map((header: any) => {
              const value = row[header];
              // Escape commas and quotes in CSV
              if (
                typeof value === "string" &&
                (value.includes(",") || value.includes('"'))
              ) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(","),
        ),
      ]
        .filter(Boolean)
        .join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", generateFilename("csv"));
      link?.style?.visibility = "hidden";
      document?.body?.appendChild(link);
      link.click();
      document?.body?.removeChild(link);
      URL.revokeObjectURL(url);

      await onExport({
        data: exportData,
        columns: includedColumns,
        format: "csv",
        filename: generateFilename("csv"),
        options: exportOptions,
      });
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Export failed. Please try again.");
    }
  }, [
    prepareExportData,
    includedColumns,
    exportOptions,
    generateFilename,
    onExport,
  ]);

  // Export to Excel
  const exportToExcel = useCallback(async () => {
    const exportData = prepareExportData();

    if (exportData?.length || 0 === 0) {
      alert("No data to export");
      return;
    }

    try {
      // Create workbook and worksheet
      const workbook = XLSX?.utils?.book_new();
      const worksheet = XLSX?.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = includedColumns?.map((col: any) => ({
        wch: col.width || Math.max(col?.label?.length, 15),
      }));
      worksheet["!cols"] = columnWidths;

      // Add metadata sheet if requested
      if (exportOptions.includeMetadata) {
        const metadata = [
          { Property: "Export Date", Value: new Date().toLocaleString() },
          { Property: "Total Records", Value: exportData?.length || 0 },
          { Property: "Columns Exported", Value: includedColumns?.length || 0 },
          {
            Property: "Filters Applied",
            Value: filters?.filter((f: any) => f.enabled).length,
          },
        ];

        if (filters?.filter((f: any) => f.enabled).length > 0) {
          metadata.push({ Property: "Active Filters", Value: "" });
          filters
            .filter((f: any) => f.enabled)
            .forEach((filter: any) => {
              metadata.push({
                Property: `${filter.label}`,
                Value: `${filter.operator}: ${filter.value}`,
              });
            });
        }

        const metadataSheet = XLSX?.utils.json_to_sheet(metadata);
        XLSX?.utils?.book_append_sheet(workbook, metadataSheet, "Metadata");
      }

      // Add main data sheet
      XLSX?.utils?.book_append_sheet(
        workbook,
        worksheet,
        exportOptions.sheetName,
      );

      // Write file
      XLSX.writeFile(workbook, generateFilename("xlsx"));

      await onExport({
        data: exportData,
        columns: includedColumns,
        format: "xlsx",
        filename: generateFilename("xlsx"),
        options: exportOptions,
      });
    } catch (error) {
      console.error("Excel export failed:", error);
      alert("Export failed. Please try again.");
    }
  }, [
    prepareExportData,
    includedColumns,
    exportOptions,
    filters,
    generateFilename,
    onExport,
  ]);

  // Export to PDF (simplified - in real app would use a proper PDF library)
  const exportToPDF = useCallback(async () => {
    alert(
      "PDF export feature would be implemented with a library like jsPDF or Puppeteer",
    );
    // Implementation would depend on requirements:
    // - Simple table: jsPDF with autoTable plugin
    // - Complex formatting: Puppeteer to generate from HTML
    // - Server-side: API endpoint that generates PDF
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      switch (exportFormat) {
        case "csv":
          await exportToCSV();
          break;
        case "xlsx":
          await exportToExcel();
          break;
        case "pdf":
          await exportToPDF();
          break;
      }
    } finally {
      setIsExporting(false);
    }
  }, [exportFormat, exportToCSV, exportToExcel, exportToPDF]);

  // Toggle column inclusion
  const toggleColumn = useCallback((columnId: string) => {
    setColumns((prev: any) =>
      prev?.map((col: any) =>
        col.id === columnId ? { ...col, included: !col.included } : col,
      ),
    );
  }, []);

  // Add filter
  const addFilter = useCallback(() => {
    const newFilter: ExportFilter = {
      id: `filter_${Date.now()}`,
      label: columns[0]?.label || "",
      field: columns[0]?.field || "",
      operator: "contains",
      value: "",
      enabled: true,
    };
    setFilters((prev: any) => [...prev, newFilter]);
  }, [columns]);

  // Update filter
  const updateFilter = useCallback(
    (filterId: string, updates: Partial<ExportFilter>) => {
      setFilters((prev: any) =>
        prev?.map((filter: any) =>
          filter.id === filterId ? { ...filter, ...updates } : filter,
        ),
      );
    },
    [],
  );

  // Remove filter
  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev: any) => prev?.filter((filter: any) => filter.id !== filterId));
  }, []);

  // Save template
  const saveTemplate = useCallback(() => {
    if (!newTemplateName.trim()) return;

    const template: Omit<ExportTemplate, "id" | "createdAt" | "updatedAt"> = {
      name: newTemplateName,
      description: newTemplateDescription,
      columns,
      filters,
      format: exportFormat,
      options: exportOptions,
      isDefault: false,
    };

    onTemplateSave?.(template);
    setNewTemplateName("");
    setNewTemplateDescription("");
    setShowSaveTemplate(false);
  }, [
    newTemplateName,
    newTemplateDescription,
    columns,
    filters,
    exportFormat,
    exportOptions,
    onTemplateSave,
  ]);

  // Load template
  const loadTemplate = useCallback(
    (template: ExportTemplate) => {
      setColumns(template.columns);
      setFilters(template.filters);
      setExportFormat(template.format);
      setExportOptions({
        ...template.options,
        sheetName: template?.options?.filename || exportOptions.sheetName,
      });
      setShowTemplates(false);
      onTemplateLoad?.(template);
    },
    [onTemplateLoad],
  );

  // Get export format icon
  const getFormatIcon = (format: string) => {
    switch (format) {
      case "csv":
        return FileText;
      case "xlsx":
        return FileSpreadsheet;
      case "pdf":
        return FileText;
      default:
        return Download;
    }
  };

  return (
    <div className={`data-export-manager ${className}`}>
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Export Data</span>
        {filteredData?.length || 0 !== data?.length || 0 && (
          <span className="bg-blue-400 text-white text-xs px-2 py-1 rounded-full">
            {filteredData?.length || 0} filtered
          </span>
        )}
      </button>

      {/* Export Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Export Data
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Configure your export settings and download your data
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Export Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Export Format
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["csv", "xlsx", "pdf"] as const).map((format: any) => {
                      const Icon = getFormatIcon(format);
                      return (
                        <button
                          key={format}
                          onClick={() => setExportFormat(format)}
                          className={`flex items-center space-x-2 p-3 border rounded-lg transition-colors ${
                            exportFormat === format
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">
                            {format.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filename */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filename
                  </label>
                  <input
                    type="text"
                    value={filename}
                    onChange={(e: any) => setFilename(e?.target?.value)}
                    placeholder="Enter filename..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Final filename: {generateFilename(exportFormat)}
                  </p>
                </div>

                {/* Column Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Columns to Export
                    </label>
                    <div className="text-sm text-gray-600">
                      {includedColumns?.length || 0} of {columns?.length || 0} selected
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {columns?.map((column: any) => (
                      <label
                        key={column.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          checked={column.included}
                          onChange={() => toggleColumn(column.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {column.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Advanced Options Toggle */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Advanced Options</span>
                  </button>
                </div>

                {/* Advanced Options */}
                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeHeaders}
                          onChange={(e: any) =>
                            setExportOptions((prev: any) => ({
                              ...prev,
                              includeHeaders: e?.target?.checked,
                            }))
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          Include Headers
                        </span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeMetadata}
                          onChange={(e: any) =>
                            setExportOptions((prev: any) => ({
                              ...prev,
                              includeMetadata: e?.target?.checked,
                            }))
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          Include Metadata
                        </span>
                      </label>
                    </div>

                    {exportFormat === "xlsx" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sheet Name
                        </label>
                        <input
                          type="text"
                          value={exportOptions.sheetName}
                          onChange={(e: any) =>
                            setExportOptions((prev: any) => ({
                              ...prev,
                              sheetName: e?.target?.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Data Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Data Preview
                  </label>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">
                        {filteredData?.length || 0} records ready for export
                      </span>
                    </div>
                    <div className="max-h-40 overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {includedColumns.slice(0, 4).map((column) => (
                              <th
                                key={column.id}
                                className="px-4 py-2 text-left text-gray-600"
                              >
                                {column.label}
                              </th>
                            ))}
                            {includedColumns?.length || 0 > 4 && (
                              <th className="px-4 py-2 text-left text-gray-600">
                                +{includedColumns?.length || 0 - 4} more...
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredData.slice(0, 3).map((row, index) => (
                            <tr
                              key={index}
                              className="border-t border-gray-200"
                            >
                              {includedColumns.slice(0, 4).map((column) => (
                                <td
                                  key={column.id}
                                  className="px-4 py-2 text-gray-900"
                                >
                                  {formatCellValue(row[column.field], column)}
                                </td>
                              ))}
                              {includedColumns?.length || 0 > 4 && (
                                <td className="px-4 py-2 text-gray-500">...</td>
                              )}
                            </tr>
                          ))}
                          {filteredData?.length || 0 > 3 && (
                            <tr>
                              <td
                                colSpan={Math.min(includedColumns?.length || 0, 5)}
                                className="px-4 py-2 text-center text-gray-500"
                              >
                                +{filteredData?.length || 0 - 3} more rows...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Template Management */}
                {templates?.length || 0 > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Export Templates
                      </label>
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {showTemplates ? "Hide" : "Show"} Templates
                      </button>
                    </div>

                    {showTemplates && (
                      <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
                        {templates?.map((template: any) => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">
                                {template.name}
                              </div>
                              <div className="text-xs text-gray-600">
                                {template.description}
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => loadTemplate(template)}
                                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                Load
                              </button>
                              <button
                                onClick={() => onTemplateDelete?.(template.id)}
                                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowSaveTemplate(true)}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Save as Template
                  </button>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting || includedColumns?.length || 0 === 0}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Export {exportFormat.toUpperCase()}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Dialog */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Save Export Template
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e: any) => setNewTemplateName(e?.target?.value)}
                  placeholder="Enter template name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e: any) => setNewTemplateDescription(e?.target?.value)}
                  placeholder="Enter description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataExportManager;

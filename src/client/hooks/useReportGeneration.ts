import { useState, useCallback, useMemo } from "react";
import type { FilterCondition } from "../../types/common.types.js";

/**
 * Report Generation Hook
 * Implements 2025 best practices for custom report generation and scheduling
 * Agent 16: Export & Reporting
 */

// Report data types
export type ReportDataValue = string | number | boolean | Date | null;
export type ReportDataRow = Record<string, ReportDataValue>;
export type ReportDataSet = ReportDataRow[];

// Report generation types
export interface ProcessedSection {
  type: "table" | "chart" | "metric" | "text";
  data?: ReportDataSet;
  fields?: ReportField[];
  config?: Record<string, unknown>;
  content?: string;
}

export interface ReportGenerationOptions {
  filters?: FilterCondition[];
  filename?: string;
  includeMetadata?: boolean;
}

export interface ReportField {
  id: string;
  name: string;
  type:
    | "text"
    | "number"
    | "date"
    | "boolean"
    | "currency"
    | "status"
    | "calculated";
  source: string; // Field path in data
  format?: (value: ReportDataValue) => string;
  aggregation?: "sum" | "avg" | "count" | "min" | "max" | "first" | "last";
  groupBy?: boolean;
  sortable?: boolean;
  width?: number;
}

export interface ReportSection {
  id: string;
  name: string;
  type: "table" | "chart" | "metric" | "text";
  fields: ReportField[];
  filters?: FilterCondition[];
  groupBy?: string[];
  sortBy?: { field: string; direction: "asc" | "desc" }[];
  chartConfig?: {
    type: "bar" | "line" | "pie" | "doughnut" | "area";
    xAxis: string;
    yAxis: string;
    series?: string[];
  };
  metricConfig?: {
    value: string;
    comparison?: {
      period: "previous" | "target";
      value: number;
    };
    format: "number" | "currency" | "percentage";
  };
  textContent?: string;
  visible: boolean;
  order: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: "operational" | "analytical" | "executive" | "compliance";
  sections: ReportSection[];
  layout: "single-column" | "two-column" | "dashboard";
  styling: {
    theme: "light" | "dark" | "brand";
    colors: string[];
    fonts: {
      heading: string;
      body: string;
    };
  };
  metadata: {
    author: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    tags: string[];
  };
  isPublic: boolean;
  isDefault: boolean;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "custom";
  customCron?: string;
  recipients: string[];
  format: "pdf" | "excel" | "csv" | "html";
  filters?: FilterCondition[];
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  format: "pdf" | "excel" | "csv" | "html";
  generatedAt: string;
  generatedBy: string;
  fileSize: number;
  downloadUrl?: string;
  status: "generating" | "completed" | "failed";
  error?: string;
  metadata: {
    dataSnapshot: string;
    filters: FilterCondition[];
    recordCount: number;
  };
}

interface UseReportGenerationOptions {
  autoSave?: boolean;
  saveInterval?: number; // milliseconds
  maxHistory?: number;
  enableScheduling?: boolean;
}

export const useReportGeneration = (
  options: UseReportGenerationOptions = {},
) => {
  const {
    autoSave = true,
    saveInterval = 30000,
    maxHistory = 50,
    enableScheduling = true,
  } = options;

  // State management
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(
    [],
  );
  const [currentTemplate, setCurrentTemplate] = useState<ReportTemplate | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate unique ID
  const generateId = useCallback(() => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Create new report template
  const createTemplate = useCallback(
    (templateData: Omit<ReportTemplate, "id" | "metadata">) => {
      const template: ReportTemplate = {
        ...templateData,
        id: generateId(),
        metadata: {
          author: "Current User", // Would come from auth context
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
          tags: [],
        },
      };

      setTemplates((prev: any) => [...prev, template]);
      return template;
    },
    [generateId],
  );

  // Update template
  const updateTemplate = useCallback(
    (templateId: string, updates: Partial<ReportTemplate>) => {
      setTemplates((prev: any) =>
        prev?.map((template: any) =>
          template.id === templateId
            ? {
                ...template,
                ...updates,
                metadata: {
                  ...template.metadata,
                  updatedAt: new Date().toISOString(),
                  version: incrementVersion(template?.metadata?.version),
                },
              }
            : template,
        ),
      );
    },
    [],
  );

  // Delete template
  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev: any) =>
      prev?.filter((template: any) => template.id !== templateId),
    );

    // Also remove associated schedules
    setSchedules((prev: any) =>
      prev?.filter((schedule: any) => schedule.reportId !== templateId),
    );
  }, []);

  // Clone template
  const cloneTemplate = useCallback(
    (templateId: string, newName?: string) => {
      const original = templates.find((t: any) => t.id === templateId);
      if (!original) return null;

      const cloned: ReportTemplate = {
        ...original,
        id: generateId(),
        name: newName || `${original.name} (Copy)`,
        metadata: {
          ...original.metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
        },
        isDefault: false,
      };

      setTemplates((prev: any) => [...prev, cloned]);
      return cloned;
    },
    [templates, generateId],
  );

  // Add section to template
  const addSection = useCallback(
    (templateId: string, section: Omit<ReportSection, "id" | "order">) => {
      setTemplates((prev: any) =>
        prev?.map((template: any) => {
          if (template.id !== templateId) return template;

          const maxOrder = Math.max(
            ...template?.sections?.map((s: any) => s.order),
            0,
          );
          const newSection: ReportSection = {
            ...section,
            id: generateId(),
            order: maxOrder + 1,
          };

          return {
            ...template,
            sections: [...template.sections, newSection],
            metadata: {
              ...template.metadata,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      );
    },
    [generateId],
  );

  // Update section
  const updateSection = useCallback(
    (
      templateId: string,
      sectionId: string,
      updates: Partial<ReportSection>,
    ) => {
      setTemplates((prev: any) =>
        prev?.map((template: any) => {
          if (template.id !== templateId) return template;

          return {
            ...template,
            sections: template?.sections?.map((section: any) =>
              section.id === sectionId ? { ...section, ...updates } : section,
            ),
            metadata: {
              ...template.metadata,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      );
    },
    [],
  );

  // Remove section
  const removeSection = useCallback((templateId: string, sectionId: string) => {
    setTemplates((prev: any) =>
      prev?.map((template: any) => {
        if (template.id !== templateId) return template;

        return {
          ...template,
          sections: template?.sections?.filter(
            (section: any) => section.id !== sectionId,
          ),
          metadata: {
            ...template.metadata,
            updatedAt: new Date().toISOString(),
          },
        };
      }),
    );
  }, []);

  // Reorder sections
  const reorderSections = useCallback(
    (templateId: string, sectionIds: string[]) => {
      setTemplates((prev: any) =>
        prev?.map((template: any) => {
          if (template.id !== templateId) return template;

          const reorderedSections = sectionIds
            .map((id, index) => {
              const section = template?.sections?.find((s: any) => s.id === id);
              return section ? { ...section, order: index } : null;
            })
            .filter(Boolean) as ReportSection[];

          return {
            ...template,
            sections: reorderedSections,
            metadata: {
              ...template.metadata,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      );
    },
    [],
  );

  // Generate report
  const generateReport = useCallback(
    async (
      templateId: string,
      data: ReportDataSet,
      format: "pdf" | "excel" | "csv" | "html" = "pdf",
      options: {
        filters?: FilterCondition[];
        filename?: string;
        includeMetadata?: boolean;
      } = {},
    ) => {
      const template = templates.find((t: any) => t.id === templateId);
      if (!template) {
        throw new Error("Template not found");
      }

      setIsGenerating(true);
      setError(null);

      // Create report record
      const report: GeneratedReport = {
        id: generateId(),
        templateId,
        name: template.name,
        format,
        generatedAt: new Date().toISOString(),
        generatedBy: "Current User", // Would come from auth context
        fileSize: 0,
        status: "generating",
        metadata: {
          dataSnapshot: new Date().toISOString(),
          filters: options.filters || [],
          recordCount: data?.length || 0,
        },
      };

      setGeneratedReports((prev: any) => [report, ...prev.slice(0, maxHistory - 1)]);

      try {
        // Process each section
        const processedSections = await Promise.all(
          template.sections
            .filter((section: any) => section.visible)
            .sort((a, b) => a.order - b.order)
            .map(async (section: any) => {
              let sectionData = [...data];

              // Apply section-specific filters
              if (section.filters?.length) {
                sectionData = applyFilters(sectionData, section.filters);
              }

              // Apply grouping
              if (section.groupBy?.length) {
                sectionData = groupData(sectionData, section.groupBy);
              }

              // Apply sorting
              if (section.sortBy?.length) {
                sectionData = sortData(sectionData, section.sortBy);
              }

              // Process based on section type
              switch (section.type) {
                case "table":
                  return processTableSection(section, sectionData);
                case "chart":
                  return processChartSection(section, sectionData);
                case "metric":
                  return processMetricSection(section, sectionData);
                case "text":
                  return processTextSection(section);
                default:
                  return null;
              }
            }),
        );

        // Generate file based on format
        let downloadUrl: string;
        let fileSize: number;

        switch (format) {
          case "excel":
            ({ downloadUrl, fileSize } = await generateExcelReport(
              template,
              processedSections,
              options,
            ));
            break;
          case "csv":
            ({ downloadUrl, fileSize } = await generateCSVReport(
              template,
              processedSections,
              options,
            ));
            break;
          case "html":
            ({ downloadUrl, fileSize } = await generateHTMLReport(
              template,
              processedSections,
              options,
            ));
            break;
          case "pdf":
          default:
            ({ downloadUrl, fileSize } = await generatePDFReport(
              template,
              processedSections,
              options,
            ));
            break;
        }

        // Update report with completion
        const completedReport: GeneratedReport = {
          ...report,
          status: "completed",
          downloadUrl,
          fileSize,
        };

        setGeneratedReports((prev: any) =>
          prev?.map((r: any) => (r.id === report.id ? completedReport : r)),
        );

        return completedReport;
      } catch (error) {
        console.error("Report generation failed:", error);

        setGeneratedReports((prev: any) =>
          prev?.map((r: any) =>
            r.id === report.id
              ? {
                  ...r,
                  status: "failed",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                }
              : r,
          ),
        );

        setError(
          error instanceof Error ? error.message : "Report generation failed",
        );
        throw error;
      } finally {
        setIsGenerating(false);
      }
    },
    [templates, generateId, maxHistory],
  );

  // Schedule management
  const createSchedule = useCallback(
    (scheduleData: Omit<ReportSchedule, "id" | "createdAt" | "updatedAt">) => {
      if (!enableScheduling) {
        throw new Error("Scheduling is not enabled");
      }

      const schedule: ReportSchedule = {
        ...scheduleData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSchedules((prev: any) => [...prev, schedule]);
      return schedule;
    },
    [enableScheduling, generateId],
  );

  // Update schedule
  const updateSchedule = useCallback(
    (scheduleId: string, updates: Partial<ReportSchedule>) => {
      setSchedules((prev: any) =>
        prev?.map((schedule: any) =>
          schedule.id === scheduleId
            ? { ...schedule, ...updates, updatedAt: new Date().toISOString() }
            : schedule,
        ),
      );
    },
    [],
  );

  // Delete schedule
  const deleteSchedule = useCallback((scheduleId: string) => {
    setSchedules((prev: any) =>
      prev?.filter((schedule: any) => schedule.id !== scheduleId),
    );
  }, []);

  // Get reports by template
  const getReportsByTemplate = useCallback(
    (templateId: string) => {
      return generatedReports?.filter(
        (report: any) => report.templateId === templateId,
      );
    },
    [generatedReports],
  );

  // Export template
  const exportTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((t: any) => t.id === templateId);
      if (!template) return;

      const exportData = {
        template,
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${template?.name?.replace(/\s+/g, "_")}_template.json`;
      document?.body?.appendChild(link);
      link.click();
      document?.body?.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [templates],
  );

  // Import template
  const importTemplate = useCallback(
    (templateData: Partial<ReportTemplate> & { template?: ReportTemplate }) => {
      try {
        const imported = templateData.template || templateData;
        const template: ReportTemplate = {
          ...imported,
          id: generateId(),
          metadata: {
            ...imported.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };

        setTemplates((prev: any) => [...prev, template]);
        return template;
      } catch (error) {
        console.error("Template import failed:", error);
        throw new Error("Invalid template format");
      }
    },
    [generateId],
  );

  // Statistics
  const statistics = useMemo(() => {
    const totalTemplates = templates?.length || 0;
    const totalReports = generatedReports?.length || 0;
    const activeSchedules = schedules?.filter((s: any) => s.enabled).length;
    const recentReports = generatedReports?.filter((r: any) => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return new Date(r.generatedAt) > dayAgo;
    }).length;

    const reportsByFormat = generatedReports.reduce(
      (acc, report) => {
        acc[report.format] = (acc[report.format] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const templatesByCategory = templates.reduce(
      (acc, template) => {
        acc[template.category] = (acc[template.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalTemplates,
      totalReports,
      activeSchedules,
      recentReports,
      reportsByFormat,
      templatesByCategory,
    };
  }, [templates, generatedReports, schedules]);

  return {
    // State
    templates,
    schedules: enableScheduling ? schedules : [],
    generatedReports,
    currentTemplate,
    isGenerating,
    error,
    statistics,

    // Template management
    createTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    setCurrentTemplate,

    // Section management
    addSection,
    updateSection,
    removeSection,
    reorderSections,

    // Report generation
    generateReport,

    // Schedule management (only if enabled)
    ...(enableScheduling && {
      createSchedule,
      updateSchedule,
      deleteSchedule,
    }),

    // Utilities
    getReportsByTemplate,
    exportTemplate,
    importTemplate,

    // Clear functions
    clearError: () => setError(null),
    clearHistory: () => setGeneratedReports([]),
  };
};

// Helper functions
function incrementVersion(version: string): string {
  const parts = version.split(".");
  const patch = parseInt(parts[2] || "0") + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

function applyFilters(data: ReportDataSet, filters: FilterCondition[]): ReportDataSet {
  // Implementation would depend on filter structure
  return data;
}

function groupData(data: ReportDataSet, groupBy: string[]): ReportDataSet {
  // Implementation would group data by specified fields
  return data;
}

function sortData(
  data: ReportDataSet,
  sortBy: { field: string; direction: "asc" | "desc" }[],
): ReportDataSet {
  return data.sort((a, b) => {
    for (const sort of sortBy) {
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      if (comparison !== 0) {
        return sort.direction === "asc" ? comparison : -comparison;
      }
    }
    return 0;
  });
}

// Section processors (simplified - would be more complex in real implementation)
async function processTableSection(section: ReportSection, data: ReportDataSet) {
  return { type: "table", data, fields: section.fields };
}

async function processChartSection(section: ReportSection, data: ReportDataSet) {
  return { type: "chart", data, config: section.chartConfig };
}

async function processMetricSection(section: ReportSection, data: ReportDataSet) {
  return { type: "metric", data, config: section.metricConfig };
}

async function processTextSection(section: ReportSection) {
  return { type: "text", content: section.textContent };
}

// Report generators (simplified - would use actual libraries)
async function generatePDFReport(
  template: ReportTemplate,
  sections: ProcessedSection[],
  options: ReportGenerationOptions,
) {
  // Would use jsPDF or similar
  return { downloadUrl: "mock-pdf-url", fileSize: 1024 };
}

async function generateExcelReport(
  template: ReportTemplate,
  sections: ProcessedSection[],
  options: ReportGenerationOptions,
) {
  // Would use XLSX or similar
  return { downloadUrl: "mock-excel-url", fileSize: 2048 };
}

async function generateCSVReport(
  template: ReportTemplate,
  sections: ProcessedSection[],
  options: ReportGenerationOptions,
) {
  // Would generate CSV content
  return { downloadUrl: "mock-csv-url", fileSize: 512 };
}

async function generateHTMLReport(
  template: ReportTemplate,
  sections: ProcessedSection[],
  options: ReportGenerationOptions,
) {
  // Would generate HTML content
  return { downloadUrl: "mock-html-url", fileSize: 1536 };
}

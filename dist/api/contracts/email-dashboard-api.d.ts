/**
 * Email Dashboard API Contract
 * Defines the API interface between frontend and backend
 * for the new table-based email dashboard
 */
import { z } from 'zod';
export declare const EmailStatusEnum: z.ZodEnum<["red", "yellow", "green"]>;
export type EmailStatus = z.infer<typeof EmailStatusEnum>;
export declare const WorkflowStateEnum: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
export type WorkflowState = z.infer<typeof WorkflowStateEnum>;
export declare const PriorityEnum: z.ZodEnum<["Critical", "High", "Medium", "Low"]>;
export type Priority = z.infer<typeof PriorityEnum>;
export declare const SortDirectionEnum: z.ZodEnum<["asc", "desc"]>;
export type SortDirection = z.infer<typeof SortDirectionEnum>;
export declare const ExportFormatEnum: z.ZodEnum<["csv", "excel", "pdf"]>;
export type ExportFormat = z.infer<typeof ExportFormatEnum>;
export declare const EmailEntitySchema: z.ZodObject<{
    po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    customers?: string[] | undefined;
    po_numbers?: string[] | undefined;
    quote_numbers?: string[] | undefined;
    case_numbers?: string[] | undefined;
    part_numbers?: string[] | undefined;
    order_references?: string[] | undefined;
}, {
    customers?: string[] | undefined;
    po_numbers?: string[] | undefined;
    quote_numbers?: string[] | undefined;
    case_numbers?: string[] | undefined;
    part_numbers?: string[] | undefined;
    order_references?: string[] | undefined;
}>;
export declare const EmailRecordSchema: z.ZodObject<{
    id: z.ZodString;
    email_alias: z.ZodString;
    requested_by: z.ZodString;
    subject: z.ZodString;
    summary: z.ZodString;
    status: z.ZodEnum<["red", "yellow", "green"]>;
    status_text: z.ZodString;
    workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
    timestamp: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
    workflow_type: z.ZodOptional<z.ZodString>;
    entities: z.ZodOptional<z.ZodObject<{
        po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    }, {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    }>>;
    isRead: z.ZodOptional<z.ZodBoolean>;
    hasAttachments: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assignedTo: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    lastUpdated: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    summary: string;
    subject: string;
    id: string;
    status: "red" | "yellow" | "green";
    workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
    email_alias: string;
    requested_by: string;
    status_text: string;
    tags?: string[] | undefined;
    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
    entities?: {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    } | undefined;
    lastUpdated?: string | undefined;
    hasAttachments?: boolean | undefined;
    assignedTo?: string | undefined;
    workflow_type?: string | undefined;
    isRead?: boolean | undefined;
    dueDate?: string | undefined;
}, {
    timestamp: string;
    summary: string;
    subject: string;
    id: string;
    status: "red" | "yellow" | "green";
    workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
    email_alias: string;
    requested_by: string;
    status_text: string;
    tags?: string[] | undefined;
    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
    entities?: {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    } | undefined;
    lastUpdated?: string | undefined;
    hasAttachments?: boolean | undefined;
    assignedTo?: string | undefined;
    workflow_type?: string | undefined;
    isRead?: boolean | undefined;
    dueDate?: string | undefined;
}>;
export type EmailRecord = z.infer<typeof EmailRecordSchema>;
export declare const DashboardStatsSchema: z.ZodObject<{
    total: z.ZodNumber;
    byStatus: z.ZodObject<{
        red: z.ZodNumber;
        yellow: z.ZodNumber;
        green: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        red: number;
        yellow: number;
        green: number;
    }, {
        red: number;
        yellow: number;
        green: number;
    }>;
    byWorkflowState: z.ZodObject<{
        START_POINT: z.ZodNumber;
        IN_PROGRESS: z.ZodNumber;
        COMPLETION: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        START_POINT: number;
        IN_PROGRESS: number;
        COMPLETION: number;
    }, {
        START_POINT: number;
        IN_PROGRESS: number;
        COMPLETION: number;
    }>;
    byPriority: z.ZodObject<{
        Critical: z.ZodNumber;
        High: z.ZodNumber;
        Medium: z.ZodNumber;
        Low: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        Critical: number;
        High: number;
        Medium: number;
        Low: number;
    }, {
        Critical: number;
        High: number;
        Medium: number;
        Low: number;
    }>;
    todayCount: z.ZodNumber;
    weekCount: z.ZodNumber;
    averageResponseTime: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    total: number;
    byStatus: {
        red: number;
        yellow: number;
        green: number;
    };
    byWorkflowState: {
        START_POINT: number;
        IN_PROGRESS: number;
        COMPLETION: number;
    };
    byPriority: {
        Critical: number;
        High: number;
        Medium: number;
        Low: number;
    };
    todayCount: number;
    weekCount: number;
    averageResponseTime?: number | undefined;
}, {
    total: number;
    byStatus: {
        red: number;
        yellow: number;
        green: number;
    };
    byWorkflowState: {
        START_POINT: number;
        IN_PROGRESS: number;
        COMPLETION: number;
    };
    byPriority: {
        Critical: number;
        High: number;
        Medium: number;
        Low: number;
    };
    todayCount: number;
    weekCount: number;
    averageResponseTime?: number | undefined;
}>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export declare const ListEmailsRequestSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
    workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
    workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
    dateRange: z.ZodOptional<z.ZodObject<{
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        start?: string | undefined;
        end?: string | undefined;
    }, {
        start?: string | undefined;
        end?: string | undefined;
    }>>;
    hasAttachments: z.ZodOptional<z.ZodBoolean>;
    isRead: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    tags?: string[] | undefined;
    search?: string | undefined;
    dateRange?: {
        start?: string | undefined;
        end?: string | undefined;
    } | undefined;
    sortBy?: string | undefined;
    hasAttachments?: boolean | undefined;
    isRead?: boolean | undefined;
    emailAliases?: string[] | undefined;
    requesters?: string[] | undefined;
    statuses?: ("red" | "yellow" | "green")[] | undefined;
    workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
    workflowTypes?: string[] | undefined;
    priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    sortDirection?: "asc" | "desc" | undefined;
}, {
    tags?: string[] | undefined;
    search?: string | undefined;
    page?: number | undefined;
    dateRange?: {
        start?: string | undefined;
        end?: string | undefined;
    } | undefined;
    pageSize?: number | undefined;
    sortBy?: string | undefined;
    hasAttachments?: boolean | undefined;
    isRead?: boolean | undefined;
    emailAliases?: string[] | undefined;
    requesters?: string[] | undefined;
    statuses?: ("red" | "yellow" | "green")[] | undefined;
    workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
    workflowTypes?: string[] | undefined;
    priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    sortDirection?: "asc" | "desc" | undefined;
}>;
export type ListEmailsRequest = z.infer<typeof ListEmailsRequestSchema>;
export declare const ListEmailsResponseSchema: z.ZodObject<{
    emails: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        email_alias: z.ZodString;
        requested_by: z.ZodString;
        subject: z.ZodString;
        summary: z.ZodString;
        status: z.ZodEnum<["red", "yellow", "green"]>;
        status_text: z.ZodString;
        workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
        timestamp: z.ZodString;
        priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
        workflow_type: z.ZodOptional<z.ZodString>;
        entities: z.ZodOptional<z.ZodObject<{
            po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }>>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    totalPages: z.ZodNumber;
    stats: z.ZodObject<{
        total: z.ZodNumber;
        byStatus: z.ZodObject<{
            red: z.ZodNumber;
            yellow: z.ZodNumber;
            green: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            red: number;
            yellow: number;
            green: number;
        }, {
            red: number;
            yellow: number;
            green: number;
        }>;
        byWorkflowState: z.ZodObject<{
            START_POINT: z.ZodNumber;
            IN_PROGRESS: z.ZodNumber;
            COMPLETION: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        }, {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        }>;
        byPriority: z.ZodObject<{
            Critical: z.ZodNumber;
            High: z.ZodNumber;
            Medium: z.ZodNumber;
            Low: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        }, {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        }>;
        todayCount: z.ZodNumber;
        weekCount: z.ZodNumber;
        averageResponseTime: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        total: number;
        byStatus: {
            red: number;
            yellow: number;
            green: number;
        };
        byWorkflowState: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        };
        byPriority: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        };
        todayCount: number;
        weekCount: number;
        averageResponseTime?: number | undefined;
    }, {
        total: number;
        byStatus: {
            red: number;
            yellow: number;
            green: number;
        };
        byWorkflowState: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        };
        byPriority: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        };
        todayCount: number;
        weekCount: number;
        averageResponseTime?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    total: number;
    stats: {
        total: number;
        byStatus: {
            red: number;
            yellow: number;
            green: number;
        };
        byWorkflowState: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        };
        byPriority: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        };
        todayCount: number;
        weekCount: number;
        averageResponseTime?: number | undefined;
    };
    page: number;
    emails: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }[];
    totalPages: number;
    pageSize: number;
}, {
    total: number;
    stats: {
        total: number;
        byStatus: {
            red: number;
            yellow: number;
            green: number;
        };
        byWorkflowState: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        };
        byPriority: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        };
        todayCount: number;
        weekCount: number;
        averageResponseTime?: number | undefined;
    };
    page: number;
    emails: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }[];
    totalPages: number;
    pageSize: number;
}>;
export type ListEmailsResponse = z.infer<typeof ListEmailsResponseSchema>;
export declare const GetEmailResponseSchema: z.ZodObject<{
    id: z.ZodString;
    email_alias: z.ZodString;
    requested_by: z.ZodString;
    subject: z.ZodString;
    summary: z.ZodString;
    status: z.ZodEnum<["red", "yellow", "green"]>;
    status_text: z.ZodString;
    workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
    timestamp: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
    workflow_type: z.ZodOptional<z.ZodString>;
    entities: z.ZodOptional<z.ZodObject<{
        po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    }, {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    }>>;
    isRead: z.ZodOptional<z.ZodBoolean>;
    hasAttachments: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assignedTo: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    lastUpdated: z.ZodOptional<z.ZodString>;
} & {
    bodyText: z.ZodOptional<z.ZodString>;
    bodyHtml: z.ZodOptional<z.ZodString>;
    recipients: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["to", "cc", "bcc"]>;
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        type: "to" | "cc" | "bcc";
        name?: string | undefined;
    }, {
        email: string;
        type: "to" | "cc" | "bcc";
        name?: string | undefined;
    }>, "many">>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodString;
        contentType: z.ZodOptional<z.ZodString>;
        size: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        size: number;
        id: string;
        filename: string;
        contentType?: string | undefined;
    }, {
        size: number;
        id: string;
        filename: string;
        contentType?: string | undefined;
    }>, "many">>;
    analysis: z.ZodOptional<z.ZodObject<{
        quickAnalysis: z.ZodOptional<z.ZodAny>;
        deepAnalysis: z.ZodOptional<z.ZodAny>;
        actionItems: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        quickAnalysis?: any;
        deepAnalysis?: any;
        actionItems?: any[] | undefined;
    }, {
        quickAnalysis?: any;
        deepAnalysis?: any;
        actionItems?: any[] | undefined;
    }>>;
    relatedEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    summary: string;
    subject: string;
    id: string;
    status: "red" | "yellow" | "green";
    workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
    email_alias: string;
    requested_by: string;
    status_text: string;
    tags?: string[] | undefined;
    analysis?: {
        quickAnalysis?: any;
        deepAnalysis?: any;
        actionItems?: any[] | undefined;
    } | undefined;
    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
    entities?: {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    } | undefined;
    attachments?: {
        size: number;
        id: string;
        filename: string;
        contentType?: string | undefined;
    }[] | undefined;
    lastUpdated?: string | undefined;
    hasAttachments?: boolean | undefined;
    assignedTo?: string | undefined;
    workflow_type?: string | undefined;
    isRead?: boolean | undefined;
    dueDate?: string | undefined;
    bodyText?: string | undefined;
    bodyHtml?: string | undefined;
    recipients?: {
        email: string;
        type: "to" | "cc" | "bcc";
        name?: string | undefined;
    }[] | undefined;
    relatedEmails?: string[] | undefined;
}, {
    timestamp: string;
    summary: string;
    subject: string;
    id: string;
    status: "red" | "yellow" | "green";
    workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
    email_alias: string;
    requested_by: string;
    status_text: string;
    tags?: string[] | undefined;
    analysis?: {
        quickAnalysis?: any;
        deepAnalysis?: any;
        actionItems?: any[] | undefined;
    } | undefined;
    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
    entities?: {
        customers?: string[] | undefined;
        po_numbers?: string[] | undefined;
        quote_numbers?: string[] | undefined;
        case_numbers?: string[] | undefined;
        part_numbers?: string[] | undefined;
        order_references?: string[] | undefined;
    } | undefined;
    attachments?: {
        size: number;
        id: string;
        filename: string;
        contentType?: string | undefined;
    }[] | undefined;
    lastUpdated?: string | undefined;
    hasAttachments?: boolean | undefined;
    assignedTo?: string | undefined;
    workflow_type?: string | undefined;
    isRead?: boolean | undefined;
    dueDate?: string | undefined;
    bodyText?: string | undefined;
    bodyHtml?: string | undefined;
    recipients?: {
        email: string;
        type: "to" | "cc" | "bcc";
        name?: string | undefined;
    }[] | undefined;
    relatedEmails?: string[] | undefined;
}>;
export type GetEmailResponse = z.infer<typeof GetEmailResponseSchema>;
export declare const UpdateEmailRequestSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["red", "yellow", "green"]>>;
    statusText: z.ZodOptional<z.ZodString>;
    workflowState: z.ZodOptional<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>>;
    priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
    isRead: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assignedTo: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tags?: string[] | undefined;
    summary?: string | undefined;
    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
    workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
    status?: "red" | "yellow" | "green" | undefined;
    statusText?: string | undefined;
    assignedTo?: string | undefined;
    isRead?: boolean | undefined;
    dueDate?: string | undefined;
}, {
    tags?: string[] | undefined;
    summary?: string | undefined;
    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
    workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
    status?: "red" | "yellow" | "green" | undefined;
    statusText?: string | undefined;
    assignedTo?: string | undefined;
    isRead?: boolean | undefined;
    dueDate?: string | undefined;
}>;
export type UpdateEmailRequest = z.infer<typeof UpdateEmailRequestSchema>;
export declare const BulkUpdateEmailsRequestSchema: z.ZodObject<{
    emailIds: z.ZodArray<z.ZodString, "many">;
    updates: z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<["red", "yellow", "green"]>>;
        statusText: z.ZodOptional<z.ZodString>;
        workflowState: z.ZodOptional<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>>;
        priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        summary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        summary?: string | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
        status?: "red" | "yellow" | "green" | undefined;
        statusText?: string | undefined;
        assignedTo?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }, {
        tags?: string[] | undefined;
        summary?: string | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
        status?: "red" | "yellow" | "green" | undefined;
        statusText?: string | undefined;
        assignedTo?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    emailIds: string[];
    updates: {
        tags?: string[] | undefined;
        summary?: string | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
        status?: "red" | "yellow" | "green" | undefined;
        statusText?: string | undefined;
        assignedTo?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
}, {
    emailIds: string[];
    updates: {
        tags?: string[] | undefined;
        summary?: string | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
        status?: "red" | "yellow" | "green" | undefined;
        statusText?: string | undefined;
        assignedTo?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
}>;
export type BulkUpdateEmailsRequest = z.infer<typeof BulkUpdateEmailsRequestSchema>;
export declare const ExportEmailsRequestSchema: z.ZodObject<{
    format: z.ZodEnum<["csv", "excel", "pdf"]>;
    filters: z.ZodOptional<z.ZodObject<Omit<{
        page: z.ZodDefault<z.ZodNumber>;
        pageSize: z.ZodDefault<z.ZodNumber>;
        search: z.ZodOptional<z.ZodString>;
        emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
        workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
        workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
        dateRange: z.ZodOptional<z.ZodObject<{
            start: z.ZodOptional<z.ZodString>;
            end: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            start?: string | undefined;
            end?: string | undefined;
        }, {
            start?: string | undefined;
            end?: string | undefined;
        }>>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "page" | "pageSize">, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        sortBy?: string | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
        sortDirection?: "asc" | "desc" | undefined;
    }, {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        sortBy?: string | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
        sortDirection?: "asc" | "desc" | undefined;
    }>>;
    columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    format: "csv" | "excel" | "pdf";
    filters?: {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        sortBy?: string | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
        sortDirection?: "asc" | "desc" | undefined;
    } | undefined;
    columns?: string[] | undefined;
}, {
    format: "csv" | "excel" | "pdf";
    filters?: {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        sortBy?: string | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
        sortDirection?: "asc" | "desc" | undefined;
    } | undefined;
    columns?: string[] | undefined;
}>;
export type ExportEmailsRequest = z.infer<typeof ExportEmailsRequestSchema>;
export declare const GetFilterOptionsResponseSchema: z.ZodObject<{
    emailAliases: z.ZodArray<z.ZodString, "many">;
    requesters: z.ZodArray<z.ZodString, "many">;
    statuses: z.ZodArray<z.ZodObject<{
        value: z.ZodEnum<["red", "yellow", "green"]>;
        label: z.ZodString;
        color: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: "red" | "yellow" | "green";
        count: number;
        label: string;
        color: string;
    }, {
        value: "red" | "yellow" | "green";
        count: number;
        label: string;
        color: string;
    }>, "many">;
    workflowStates: z.ZodArray<z.ZodObject<{
        value: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        count: number;
        label: string;
    }, {
        value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        count: number;
        label: string;
    }>, "many">;
    workflowTypes: z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
        label: string;
    }, {
        value: string;
        count: number;
        label: string;
    }>, "many">;
    priorities: z.ZodArray<z.ZodObject<{
        value: z.ZodEnum<["Critical", "High", "Medium", "Low"]>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: "Critical" | "High" | "Medium" | "Low";
        count: number;
        label: string;
    }, {
        value: "Critical" | "High" | "Medium" | "Low";
        count: number;
        label: string;
    }>, "many">;
    tags: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    tags: string[];
    emailAliases: string[];
    requesters: string[];
    statuses: {
        value: "red" | "yellow" | "green";
        count: number;
        label: string;
        color: string;
    }[];
    workflowStates: {
        value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        count: number;
        label: string;
    }[];
    workflowTypes: {
        value: string;
        count: number;
        label: string;
    }[];
    priorities: {
        value: "Critical" | "High" | "Medium" | "Low";
        count: number;
        label: string;
    }[];
}, {
    tags: string[];
    emailAliases: string[];
    requesters: string[];
    statuses: {
        value: "red" | "yellow" | "green";
        count: number;
        label: string;
        color: string;
    }[];
    workflowStates: {
        value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        count: number;
        label: string;
    }[];
    workflowTypes: {
        value: string;
        count: number;
        label: string;
    }[];
    priorities: {
        value: "Critical" | "High" | "Medium" | "Low";
        count: number;
        label: string;
    }[];
}>;
export type GetFilterOptionsResponse = z.infer<typeof GetFilterOptionsResponseSchema>;
export declare const FilterPresetSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filters: z.ZodObject<Omit<{
        page: z.ZodDefault<z.ZodNumber>;
        pageSize: z.ZodDefault<z.ZodNumber>;
        search: z.ZodOptional<z.ZodString>;
        emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
        workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
        workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
        dateRange: z.ZodOptional<z.ZodObject<{
            start: z.ZodOptional<z.ZodString>;
            end: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            start?: string | undefined;
            end?: string | undefined;
        }, {
            start?: string | undefined;
            end?: string | undefined;
        }>>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    }, {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    }>;
    isDefault: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    createdAt: string;
    updatedAt: string;
    id: string;
    filters: {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    };
    isDefault: boolean;
    description?: string | undefined;
}, {
    name: string;
    createdAt: string;
    updatedAt: string;
    id: string;
    filters: {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    };
    isDefault: boolean;
    description?: string | undefined;
}>;
export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export declare const CreateFilterPresetRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filters: z.ZodObject<Omit<{
        page: z.ZodDefault<z.ZodNumber>;
        pageSize: z.ZodDefault<z.ZodNumber>;
        search: z.ZodOptional<z.ZodString>;
        emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
        workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
        workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
        dateRange: z.ZodOptional<z.ZodObject<{
            start: z.ZodOptional<z.ZodString>;
            end: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            start?: string | undefined;
            end?: string | undefined;
        }, {
            start?: string | undefined;
            end?: string | undefined;
        }>>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    }, {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    }>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    filters: {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    };
    description?: string | undefined;
    isDefault?: boolean | undefined;
}, {
    name: string;
    filters: {
        tags?: string[] | undefined;
        search?: string | undefined;
        dateRange?: {
            start?: string | undefined;
            end?: string | undefined;
        } | undefined;
        hasAttachments?: boolean | undefined;
        isRead?: boolean | undefined;
        emailAliases?: string[] | undefined;
        requesters?: string[] | undefined;
        statuses?: ("red" | "yellow" | "green")[] | undefined;
        workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
        workflowTypes?: string[] | undefined;
        priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
    };
    description?: string | undefined;
    isDefault?: boolean | undefined;
}>;
export type CreateFilterPresetRequest = z.infer<typeof CreateFilterPresetRequestSchema>;
export declare const EmailUpdateEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"email.update">;
    data: z.ZodObject<{
        id: z.ZodString;
        email_alias: z.ZodString;
        requested_by: z.ZodString;
        subject: z.ZodString;
        summary: z.ZodString;
        status: z.ZodEnum<["red", "yellow", "green"]>;
        status_text: z.ZodString;
        workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
        timestamp: z.ZodString;
        priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
        workflow_type: z.ZodOptional<z.ZodString>;
        entities: z.ZodOptional<z.ZodObject<{
            po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }>>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.update";
}, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.update";
}>;
export declare const EmailCreateEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"email.create">;
    data: z.ZodObject<{
        id: z.ZodString;
        email_alias: z.ZodString;
        requested_by: z.ZodString;
        subject: z.ZodString;
        summary: z.ZodString;
        status: z.ZodEnum<["red", "yellow", "green"]>;
        status_text: z.ZodString;
        workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
        timestamp: z.ZodString;
        priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
        workflow_type: z.ZodOptional<z.ZodString>;
        entities: z.ZodOptional<z.ZodObject<{
            po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }>>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.create";
}, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.create";
}>;
export declare const EmailDeleteEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"email.delete">;
    data: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        id: string;
    };
    type: "email.delete";
}, {
    data: {
        id: string;
    };
    type: "email.delete";
}>;
export declare const StatsUpdateEventSchema: z.ZodObject<{
    type: z.ZodLiteral<"stats.update">;
    data: z.ZodObject<{
        total: z.ZodOptional<z.ZodNumber>;
        byStatus: z.ZodOptional<z.ZodObject<{
            red: z.ZodNumber;
            yellow: z.ZodNumber;
            green: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            red: number;
            yellow: number;
            green: number;
        }, {
            red: number;
            yellow: number;
            green: number;
        }>>;
        byWorkflowState: z.ZodOptional<z.ZodObject<{
            START_POINT: z.ZodNumber;
            IN_PROGRESS: z.ZodNumber;
            COMPLETION: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        }, {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        }>>;
        byPriority: z.ZodOptional<z.ZodObject<{
            Critical: z.ZodNumber;
            High: z.ZodNumber;
            Medium: z.ZodNumber;
            Low: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        }, {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        }>>;
        todayCount: z.ZodOptional<z.ZodNumber>;
        weekCount: z.ZodOptional<z.ZodNumber>;
        averageResponseTime: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    }, {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    };
    type: "stats.update";
}, {
    data: {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    };
    type: "stats.update";
}>;
export declare const WebSocketEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"email.update">;
    data: z.ZodObject<{
        id: z.ZodString;
        email_alias: z.ZodString;
        requested_by: z.ZodString;
        subject: z.ZodString;
        summary: z.ZodString;
        status: z.ZodEnum<["red", "yellow", "green"]>;
        status_text: z.ZodString;
        workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
        timestamp: z.ZodString;
        priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
        workflow_type: z.ZodOptional<z.ZodString>;
        entities: z.ZodOptional<z.ZodObject<{
            po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }>>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.update";
}, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.update";
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.create">;
    data: z.ZodObject<{
        id: z.ZodString;
        email_alias: z.ZodString;
        requested_by: z.ZodString;
        subject: z.ZodString;
        summary: z.ZodString;
        status: z.ZodEnum<["red", "yellow", "green"]>;
        status_text: z.ZodString;
        workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
        timestamp: z.ZodString;
        priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
        workflow_type: z.ZodOptional<z.ZodString>;
        entities: z.ZodOptional<z.ZodObject<{
            po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }, {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        }>>;
        isRead: z.ZodOptional<z.ZodBoolean>;
        hasAttachments: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        assignedTo: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }, {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.create";
}, {
    data: {
        timestamp: string;
        summary: string;
        subject: string;
        id: string;
        status: "red" | "yellow" | "green";
        workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        email_alias: string;
        requested_by: string;
        status_text: string;
        tags?: string[] | undefined;
        priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
        entities?: {
            customers?: string[] | undefined;
            po_numbers?: string[] | undefined;
            quote_numbers?: string[] | undefined;
            case_numbers?: string[] | undefined;
            part_numbers?: string[] | undefined;
            order_references?: string[] | undefined;
        } | undefined;
        lastUpdated?: string | undefined;
        hasAttachments?: boolean | undefined;
        assignedTo?: string | undefined;
        workflow_type?: string | undefined;
        isRead?: boolean | undefined;
        dueDate?: string | undefined;
    };
    type: "email.create";
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.delete">;
    data: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        id: string;
    };
    type: "email.delete";
}, {
    data: {
        id: string;
    };
    type: "email.delete";
}>, z.ZodObject<{
    type: z.ZodLiteral<"stats.update">;
    data: z.ZodObject<{
        total: z.ZodOptional<z.ZodNumber>;
        byStatus: z.ZodOptional<z.ZodObject<{
            red: z.ZodNumber;
            yellow: z.ZodNumber;
            green: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            red: number;
            yellow: number;
            green: number;
        }, {
            red: number;
            yellow: number;
            green: number;
        }>>;
        byWorkflowState: z.ZodOptional<z.ZodObject<{
            START_POINT: z.ZodNumber;
            IN_PROGRESS: z.ZodNumber;
            COMPLETION: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        }, {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        }>>;
        byPriority: z.ZodOptional<z.ZodObject<{
            Critical: z.ZodNumber;
            High: z.ZodNumber;
            Medium: z.ZodNumber;
            Low: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        }, {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        }>>;
        todayCount: z.ZodOptional<z.ZodNumber>;
        weekCount: z.ZodOptional<z.ZodNumber>;
        averageResponseTime: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    }, {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    data: {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    };
    type: "stats.update";
}, {
    data: {
        total?: number | undefined;
        averageResponseTime?: number | undefined;
        byStatus?: {
            red: number;
            yellow: number;
            green: number;
        } | undefined;
        byWorkflowState?: {
            START_POINT: number;
            IN_PROGRESS: number;
            COMPLETION: number;
        } | undefined;
        byPriority?: {
            Critical: number;
            High: number;
            Medium: number;
            Low: number;
        } | undefined;
        todayCount?: number | undefined;
        weekCount?: number | undefined;
    };
    type: "stats.update";
}>]>;
export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;
export declare const ErrorResponseSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: any;
    }, {
        code: string;
        message: string;
        details?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        code: string;
        message: string;
        details?: any;
    };
}, {
    error: {
        code: string;
        message: string;
        details?: any;
    };
}>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export declare const API_ENDPOINTS: {
    readonly listEmails: {
        readonly method: "GET";
        readonly path: "/api/emails";
        readonly request: z.ZodObject<{
            page: z.ZodDefault<z.ZodNumber>;
            pageSize: z.ZodDefault<z.ZodNumber>;
            search: z.ZodOptional<z.ZodString>;
            emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
            workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
            workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
            dateRange: z.ZodOptional<z.ZodObject<{
                start: z.ZodOptional<z.ZodString>;
                end: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                start?: string | undefined;
                end?: string | undefined;
            }, {
                start?: string | undefined;
                end?: string | undefined;
            }>>;
            hasAttachments: z.ZodOptional<z.ZodBoolean>;
            isRead: z.ZodOptional<z.ZodBoolean>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            sortBy: z.ZodOptional<z.ZodString>;
            sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            page: number;
            pageSize: number;
            tags?: string[] | undefined;
            search?: string | undefined;
            dateRange?: {
                start?: string | undefined;
                end?: string | undefined;
            } | undefined;
            sortBy?: string | undefined;
            hasAttachments?: boolean | undefined;
            isRead?: boolean | undefined;
            emailAliases?: string[] | undefined;
            requesters?: string[] | undefined;
            statuses?: ("red" | "yellow" | "green")[] | undefined;
            workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
            workflowTypes?: string[] | undefined;
            priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            sortDirection?: "asc" | "desc" | undefined;
        }, {
            tags?: string[] | undefined;
            search?: string | undefined;
            page?: number | undefined;
            dateRange?: {
                start?: string | undefined;
                end?: string | undefined;
            } | undefined;
            pageSize?: number | undefined;
            sortBy?: string | undefined;
            hasAttachments?: boolean | undefined;
            isRead?: boolean | undefined;
            emailAliases?: string[] | undefined;
            requesters?: string[] | undefined;
            statuses?: ("red" | "yellow" | "green")[] | undefined;
            workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
            workflowTypes?: string[] | undefined;
            priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            sortDirection?: "asc" | "desc" | undefined;
        }>;
        readonly response: z.ZodObject<{
            emails: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                email_alias: z.ZodString;
                requested_by: z.ZodString;
                subject: z.ZodString;
                summary: z.ZodString;
                status: z.ZodEnum<["red", "yellow", "green"]>;
                status_text: z.ZodString;
                workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
                timestamp: z.ZodString;
                priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
                workflow_type: z.ZodOptional<z.ZodString>;
                entities: z.ZodOptional<z.ZodObject<{
                    po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "strip", z.ZodTypeAny, {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                }, {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                }>>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                assignedTo: z.ZodOptional<z.ZodString>;
                dueDate: z.ZodOptional<z.ZodString>;
                lastUpdated: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }, {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }>, "many">;
            total: z.ZodNumber;
            page: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalPages: z.ZodNumber;
            stats: z.ZodObject<{
                total: z.ZodNumber;
                byStatus: z.ZodObject<{
                    red: z.ZodNumber;
                    yellow: z.ZodNumber;
                    green: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    red: number;
                    yellow: number;
                    green: number;
                }, {
                    red: number;
                    yellow: number;
                    green: number;
                }>;
                byWorkflowState: z.ZodObject<{
                    START_POINT: z.ZodNumber;
                    IN_PROGRESS: z.ZodNumber;
                    COMPLETION: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                }, {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                }>;
                byPriority: z.ZodObject<{
                    Critical: z.ZodNumber;
                    High: z.ZodNumber;
                    Medium: z.ZodNumber;
                    Low: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                }, {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                }>;
                todayCount: z.ZodNumber;
                weekCount: z.ZodNumber;
                averageResponseTime: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                total: number;
                byStatus: {
                    red: number;
                    yellow: number;
                    green: number;
                };
                byWorkflowState: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                };
                byPriority: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                };
                todayCount: number;
                weekCount: number;
                averageResponseTime?: number | undefined;
            }, {
                total: number;
                byStatus: {
                    red: number;
                    yellow: number;
                    green: number;
                };
                byWorkflowState: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                };
                byPriority: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                };
                todayCount: number;
                weekCount: number;
                averageResponseTime?: number | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            total: number;
            stats: {
                total: number;
                byStatus: {
                    red: number;
                    yellow: number;
                    green: number;
                };
                byWorkflowState: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                };
                byPriority: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                };
                todayCount: number;
                weekCount: number;
                averageResponseTime?: number | undefined;
            };
            page: number;
            emails: {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }[];
            totalPages: number;
            pageSize: number;
        }, {
            total: number;
            stats: {
                total: number;
                byStatus: {
                    red: number;
                    yellow: number;
                    green: number;
                };
                byWorkflowState: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                };
                byPriority: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                };
                todayCount: number;
                weekCount: number;
                averageResponseTime?: number | undefined;
            };
            page: number;
            emails: {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }[];
            totalPages: number;
            pageSize: number;
        }>;
    };
    readonly getEmail: {
        readonly method: "GET";
        readonly path: "/api/emails/:id";
        readonly response: z.ZodObject<{
            id: z.ZodString;
            email_alias: z.ZodString;
            requested_by: z.ZodString;
            subject: z.ZodString;
            summary: z.ZodString;
            status: z.ZodEnum<["red", "yellow", "green"]>;
            status_text: z.ZodString;
            workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
            timestamp: z.ZodString;
            priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
            workflow_type: z.ZodOptional<z.ZodString>;
            entities: z.ZodOptional<z.ZodObject<{
                po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            }, {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            }>>;
            isRead: z.ZodOptional<z.ZodBoolean>;
            hasAttachments: z.ZodOptional<z.ZodBoolean>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            assignedTo: z.ZodOptional<z.ZodString>;
            dueDate: z.ZodOptional<z.ZodString>;
            lastUpdated: z.ZodOptional<z.ZodString>;
        } & {
            bodyText: z.ZodOptional<z.ZodString>;
            bodyHtml: z.ZodOptional<z.ZodString>;
            recipients: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["to", "cc", "bcc"]>;
                name: z.ZodOptional<z.ZodString>;
                email: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                email: string;
                type: "to" | "cc" | "bcc";
                name?: string | undefined;
            }, {
                email: string;
                type: "to" | "cc" | "bcc";
                name?: string | undefined;
            }>, "many">>;
            attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                filename: z.ZodString;
                contentType: z.ZodOptional<z.ZodString>;
                size: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                size: number;
                id: string;
                filename: string;
                contentType?: string | undefined;
            }, {
                size: number;
                id: string;
                filename: string;
                contentType?: string | undefined;
            }>, "many">>;
            analysis: z.ZodOptional<z.ZodObject<{
                quickAnalysis: z.ZodOptional<z.ZodAny>;
                deepAnalysis: z.ZodOptional<z.ZodAny>;
                actionItems: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
            }, "strip", z.ZodTypeAny, {
                quickAnalysis?: any;
                deepAnalysis?: any;
                actionItems?: any[] | undefined;
            }, {
                quickAnalysis?: any;
                deepAnalysis?: any;
                actionItems?: any[] | undefined;
            }>>;
            relatedEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            summary: string;
            subject: string;
            id: string;
            status: "red" | "yellow" | "green";
            workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
            email_alias: string;
            requested_by: string;
            status_text: string;
            tags?: string[] | undefined;
            analysis?: {
                quickAnalysis?: any;
                deepAnalysis?: any;
                actionItems?: any[] | undefined;
            } | undefined;
            priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
            entities?: {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            } | undefined;
            attachments?: {
                size: number;
                id: string;
                filename: string;
                contentType?: string | undefined;
            }[] | undefined;
            lastUpdated?: string | undefined;
            hasAttachments?: boolean | undefined;
            assignedTo?: string | undefined;
            workflow_type?: string | undefined;
            isRead?: boolean | undefined;
            dueDate?: string | undefined;
            bodyText?: string | undefined;
            bodyHtml?: string | undefined;
            recipients?: {
                email: string;
                type: "to" | "cc" | "bcc";
                name?: string | undefined;
            }[] | undefined;
            relatedEmails?: string[] | undefined;
        }, {
            timestamp: string;
            summary: string;
            subject: string;
            id: string;
            status: "red" | "yellow" | "green";
            workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
            email_alias: string;
            requested_by: string;
            status_text: string;
            tags?: string[] | undefined;
            analysis?: {
                quickAnalysis?: any;
                deepAnalysis?: any;
                actionItems?: any[] | undefined;
            } | undefined;
            priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
            entities?: {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            } | undefined;
            attachments?: {
                size: number;
                id: string;
                filename: string;
                contentType?: string | undefined;
            }[] | undefined;
            lastUpdated?: string | undefined;
            hasAttachments?: boolean | undefined;
            assignedTo?: string | undefined;
            workflow_type?: string | undefined;
            isRead?: boolean | undefined;
            dueDate?: string | undefined;
            bodyText?: string | undefined;
            bodyHtml?: string | undefined;
            recipients?: {
                email: string;
                type: "to" | "cc" | "bcc";
                name?: string | undefined;
            }[] | undefined;
            relatedEmails?: string[] | undefined;
        }>;
    };
    readonly updateEmail: {
        readonly method: "PATCH";
        readonly path: "/api/emails/:id";
        readonly request: z.ZodObject<{
            status: z.ZodOptional<z.ZodEnum<["red", "yellow", "green"]>>;
            statusText: z.ZodOptional<z.ZodString>;
            workflowState: z.ZodOptional<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>>;
            priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
            isRead: z.ZodOptional<z.ZodBoolean>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            assignedTo: z.ZodOptional<z.ZodString>;
            dueDate: z.ZodOptional<z.ZodString>;
            summary: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            tags?: string[] | undefined;
            summary?: string | undefined;
            priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
            workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
            status?: "red" | "yellow" | "green" | undefined;
            statusText?: string | undefined;
            assignedTo?: string | undefined;
            isRead?: boolean | undefined;
            dueDate?: string | undefined;
        }, {
            tags?: string[] | undefined;
            summary?: string | undefined;
            priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
            workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
            status?: "red" | "yellow" | "green" | undefined;
            statusText?: string | undefined;
            assignedTo?: string | undefined;
            isRead?: boolean | undefined;
            dueDate?: string | undefined;
        }>;
        readonly response: z.ZodObject<{
            id: z.ZodString;
            email_alias: z.ZodString;
            requested_by: z.ZodString;
            subject: z.ZodString;
            summary: z.ZodString;
            status: z.ZodEnum<["red", "yellow", "green"]>;
            status_text: z.ZodString;
            workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
            timestamp: z.ZodString;
            priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
            workflow_type: z.ZodOptional<z.ZodString>;
            entities: z.ZodOptional<z.ZodObject<{
                po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            }, {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            }>>;
            isRead: z.ZodOptional<z.ZodBoolean>;
            hasAttachments: z.ZodOptional<z.ZodBoolean>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            assignedTo: z.ZodOptional<z.ZodString>;
            dueDate: z.ZodOptional<z.ZodString>;
            lastUpdated: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            summary: string;
            subject: string;
            id: string;
            status: "red" | "yellow" | "green";
            workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
            email_alias: string;
            requested_by: string;
            status_text: string;
            tags?: string[] | undefined;
            priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
            entities?: {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            } | undefined;
            lastUpdated?: string | undefined;
            hasAttachments?: boolean | undefined;
            assignedTo?: string | undefined;
            workflow_type?: string | undefined;
            isRead?: boolean | undefined;
            dueDate?: string | undefined;
        }, {
            timestamp: string;
            summary: string;
            subject: string;
            id: string;
            status: "red" | "yellow" | "green";
            workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
            email_alias: string;
            requested_by: string;
            status_text: string;
            tags?: string[] | undefined;
            priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
            entities?: {
                customers?: string[] | undefined;
                po_numbers?: string[] | undefined;
                quote_numbers?: string[] | undefined;
                case_numbers?: string[] | undefined;
                part_numbers?: string[] | undefined;
                order_references?: string[] | undefined;
            } | undefined;
            lastUpdated?: string | undefined;
            hasAttachments?: boolean | undefined;
            assignedTo?: string | undefined;
            workflow_type?: string | undefined;
            isRead?: boolean | undefined;
            dueDate?: string | undefined;
        }>;
    };
    readonly bulkUpdateEmails: {
        readonly method: "PATCH";
        readonly path: "/api/emails/bulk";
        readonly request: z.ZodObject<{
            emailIds: z.ZodArray<z.ZodString, "many">;
            updates: z.ZodObject<{
                status: z.ZodOptional<z.ZodEnum<["red", "yellow", "green"]>>;
                statusText: z.ZodOptional<z.ZodString>;
                workflowState: z.ZodOptional<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>>;
                priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                assignedTo: z.ZodOptional<z.ZodString>;
                dueDate: z.ZodOptional<z.ZodString>;
                summary: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                summary?: string | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
                status?: "red" | "yellow" | "green" | undefined;
                statusText?: string | undefined;
                assignedTo?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }, {
                tags?: string[] | undefined;
                summary?: string | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
                status?: "red" | "yellow" | "green" | undefined;
                statusText?: string | undefined;
                assignedTo?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            emailIds: string[];
            updates: {
                tags?: string[] | undefined;
                summary?: string | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
                status?: "red" | "yellow" | "green" | undefined;
                statusText?: string | undefined;
                assignedTo?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            };
        }, {
            emailIds: string[];
            updates: {
                tags?: string[] | undefined;
                summary?: string | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
                status?: "red" | "yellow" | "green" | undefined;
                statusText?: string | undefined;
                assignedTo?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            };
        }>;
        readonly response: z.ZodObject<{
            updated: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            updated: number;
        }, {
            updated: number;
        }>;
    };
    readonly deleteEmail: {
        readonly method: "DELETE";
        readonly path: "/api/emails/:id";
        readonly response: z.ZodObject<{
            success: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
        }, {
            success: boolean;
        }>;
    };
    readonly exportEmails: {
        readonly method: "POST";
        readonly path: "/api/emails/export";
        readonly request: z.ZodObject<{
            format: z.ZodEnum<["csv", "excel", "pdf"]>;
            filters: z.ZodOptional<z.ZodObject<Omit<{
                page: z.ZodDefault<z.ZodNumber>;
                pageSize: z.ZodDefault<z.ZodNumber>;
                search: z.ZodOptional<z.ZodString>;
                emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
                workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
                workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
                dateRange: z.ZodOptional<z.ZodObject<{
                    start: z.ZodOptional<z.ZodString>;
                    end: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    start?: string | undefined;
                    end?: string | undefined;
                }, {
                    start?: string | undefined;
                    end?: string | undefined;
                }>>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                sortBy: z.ZodOptional<z.ZodString>;
                sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            }, "page" | "pageSize">, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                sortBy?: string | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                sortDirection?: "asc" | "desc" | undefined;
            }, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                sortBy?: string | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                sortDirection?: "asc" | "desc" | undefined;
            }>>;
            columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            format: "csv" | "excel" | "pdf";
            filters?: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                sortBy?: string | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                sortDirection?: "asc" | "desc" | undefined;
            } | undefined;
            columns?: string[] | undefined;
        }, {
            format: "csv" | "excel" | "pdf";
            filters?: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                sortBy?: string | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                sortDirection?: "asc" | "desc" | undefined;
            } | undefined;
            columns?: string[] | undefined;
        }>;
        readonly response: z.ZodObject<{
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
        }, {
            url: string;
        }>;
    };
    readonly getFilterOptions: {
        readonly method: "GET";
        readonly path: "/api/emails/filter-options";
        readonly response: z.ZodObject<{
            emailAliases: z.ZodArray<z.ZodString, "many">;
            requesters: z.ZodArray<z.ZodString, "many">;
            statuses: z.ZodArray<z.ZodObject<{
                value: z.ZodEnum<["red", "yellow", "green"]>;
                label: z.ZodString;
                color: z.ZodString;
                count: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                value: "red" | "yellow" | "green";
                count: number;
                label: string;
                color: string;
            }, {
                value: "red" | "yellow" | "green";
                count: number;
                label: string;
                color: string;
            }>, "many">;
            workflowStates: z.ZodArray<z.ZodObject<{
                value: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
                label: z.ZodString;
                count: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                count: number;
                label: string;
            }, {
                value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                count: number;
                label: string;
            }>, "many">;
            workflowTypes: z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodString;
                count: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                value: string;
                count: number;
                label: string;
            }, {
                value: string;
                count: number;
                label: string;
            }>, "many">;
            priorities: z.ZodArray<z.ZodObject<{
                value: z.ZodEnum<["Critical", "High", "Medium", "Low"]>;
                label: z.ZodString;
                count: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                value: "Critical" | "High" | "Medium" | "Low";
                count: number;
                label: string;
            }, {
                value: "Critical" | "High" | "Medium" | "Low";
                count: number;
                label: string;
            }>, "many">;
            tags: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            tags: string[];
            emailAliases: string[];
            requesters: string[];
            statuses: {
                value: "red" | "yellow" | "green";
                count: number;
                label: string;
                color: string;
            }[];
            workflowStates: {
                value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                count: number;
                label: string;
            }[];
            workflowTypes: {
                value: string;
                count: number;
                label: string;
            }[];
            priorities: {
                value: "Critical" | "High" | "Medium" | "Low";
                count: number;
                label: string;
            }[];
        }, {
            tags: string[];
            emailAliases: string[];
            requesters: string[];
            statuses: {
                value: "red" | "yellow" | "green";
                count: number;
                label: string;
                color: string;
            }[];
            workflowStates: {
                value: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                count: number;
                label: string;
            }[];
            workflowTypes: {
                value: string;
                count: number;
                label: string;
            }[];
            priorities: {
                value: "Critical" | "High" | "Medium" | "Low";
                count: number;
                label: string;
            }[];
        }>;
    };
    readonly listFilterPresets: {
        readonly method: "GET";
        readonly path: "/api/filter-presets";
        readonly response: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            filters: z.ZodObject<Omit<{
                page: z.ZodDefault<z.ZodNumber>;
                pageSize: z.ZodDefault<z.ZodNumber>;
                search: z.ZodOptional<z.ZodString>;
                emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
                workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
                workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
                dateRange: z.ZodOptional<z.ZodObject<{
                    start: z.ZodOptional<z.ZodString>;
                    end: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    start?: string | undefined;
                    end?: string | undefined;
                }, {
                    start?: string | undefined;
                    end?: string | undefined;
                }>>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                sortBy: z.ZodOptional<z.ZodString>;
                sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }>;
            isDefault: z.ZodBoolean;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            createdAt: string;
            updatedAt: string;
            id: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            isDefault: boolean;
            description?: string | undefined;
        }, {
            name: string;
            createdAt: string;
            updatedAt: string;
            id: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            isDefault: boolean;
            description?: string | undefined;
        }>, "many">;
    };
    readonly createFilterPreset: {
        readonly method: "POST";
        readonly path: "/api/filter-presets";
        readonly request: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            filters: z.ZodObject<Omit<{
                page: z.ZodDefault<z.ZodNumber>;
                pageSize: z.ZodDefault<z.ZodNumber>;
                search: z.ZodOptional<z.ZodString>;
                emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
                workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
                workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
                dateRange: z.ZodOptional<z.ZodObject<{
                    start: z.ZodOptional<z.ZodString>;
                    end: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    start?: string | undefined;
                    end?: string | undefined;
                }, {
                    start?: string | undefined;
                    end?: string | undefined;
                }>>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                sortBy: z.ZodOptional<z.ZodString>;
                sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }>;
            isDefault: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            description?: string | undefined;
            isDefault?: boolean | undefined;
        }, {
            name: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            description?: string | undefined;
            isDefault?: boolean | undefined;
        }>;
        readonly response: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            filters: z.ZodObject<Omit<{
                page: z.ZodDefault<z.ZodNumber>;
                pageSize: z.ZodDefault<z.ZodNumber>;
                search: z.ZodOptional<z.ZodString>;
                emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
                workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
                workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
                dateRange: z.ZodOptional<z.ZodObject<{
                    start: z.ZodOptional<z.ZodString>;
                    end: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    start?: string | undefined;
                    end?: string | undefined;
                }, {
                    start?: string | undefined;
                    end?: string | undefined;
                }>>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                sortBy: z.ZodOptional<z.ZodString>;
                sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }>;
            isDefault: z.ZodBoolean;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            createdAt: string;
            updatedAt: string;
            id: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            isDefault: boolean;
            description?: string | undefined;
        }, {
            name: string;
            createdAt: string;
            updatedAt: string;
            id: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            isDefault: boolean;
            description?: string | undefined;
        }>;
    };
    readonly updateFilterPreset: {
        readonly method: "PATCH";
        readonly path: "/api/filter-presets/:id";
        readonly request: z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            filters: z.ZodOptional<z.ZodObject<Omit<{
                page: z.ZodDefault<z.ZodNumber>;
                pageSize: z.ZodDefault<z.ZodNumber>;
                search: z.ZodOptional<z.ZodString>;
                emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
                workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
                workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
                dateRange: z.ZodOptional<z.ZodObject<{
                    start: z.ZodOptional<z.ZodString>;
                    end: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    start?: string | undefined;
                    end?: string | undefined;
                }, {
                    start?: string | undefined;
                    end?: string | undefined;
                }>>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                sortBy: z.ZodOptional<z.ZodString>;
                sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }>>;
            isDefault: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            name?: string | undefined;
            description?: string | undefined;
            filters?: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            } | undefined;
            isDefault?: boolean | undefined;
        }, {
            name?: string | undefined;
            description?: string | undefined;
            filters?: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            } | undefined;
            isDefault?: boolean | undefined;
        }>;
        readonly response: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            filters: z.ZodObject<Omit<{
                page: z.ZodDefault<z.ZodNumber>;
                pageSize: z.ZodDefault<z.ZodNumber>;
                search: z.ZodOptional<z.ZodString>;
                emailAliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                requesters: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                statuses: z.ZodOptional<z.ZodArray<z.ZodEnum<["red", "yellow", "green"]>, "many">>;
                workflowStates: z.ZodOptional<z.ZodArray<z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>, "many">>;
                workflowTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                priorities: z.ZodOptional<z.ZodArray<z.ZodEnum<["Critical", "High", "Medium", "Low"]>, "many">>;
                dateRange: z.ZodOptional<z.ZodObject<{
                    start: z.ZodOptional<z.ZodString>;
                    end: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    start?: string | undefined;
                    end?: string | undefined;
                }, {
                    start?: string | undefined;
                    end?: string | undefined;
                }>>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                sortBy: z.ZodOptional<z.ZodString>;
                sortDirection: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            }, "page" | "pageSize" | "sortBy" | "sortDirection">, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }, {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            }>;
            isDefault: z.ZodBoolean;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            createdAt: string;
            updatedAt: string;
            id: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            isDefault: boolean;
            description?: string | undefined;
        }, {
            name: string;
            createdAt: string;
            updatedAt: string;
            id: string;
            filters: {
                tags?: string[] | undefined;
                search?: string | undefined;
                dateRange?: {
                    start?: string | undefined;
                    end?: string | undefined;
                } | undefined;
                hasAttachments?: boolean | undefined;
                isRead?: boolean | undefined;
                emailAliases?: string[] | undefined;
                requesters?: string[] | undefined;
                statuses?: ("red" | "yellow" | "green")[] | undefined;
                workflowStates?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                workflowTypes?: string[] | undefined;
                priorities?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
            };
            isDefault: boolean;
            description?: string | undefined;
        }>;
    };
    readonly deleteFilterPreset: {
        readonly method: "DELETE";
        readonly path: "/api/filter-presets/:id";
        readonly response: z.ZodObject<{
            success: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            success: boolean;
        }, {
            success: boolean;
        }>;
    };
    readonly getDashboardStats: {
        readonly method: "GET";
        readonly path: "/api/emails/stats";
        readonly response: z.ZodObject<{
            total: z.ZodNumber;
            byStatus: z.ZodObject<{
                red: z.ZodNumber;
                yellow: z.ZodNumber;
                green: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                red: number;
                yellow: number;
                green: number;
            }, {
                red: number;
                yellow: number;
                green: number;
            }>;
            byWorkflowState: z.ZodObject<{
                START_POINT: z.ZodNumber;
                IN_PROGRESS: z.ZodNumber;
                COMPLETION: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                START_POINT: number;
                IN_PROGRESS: number;
                COMPLETION: number;
            }, {
                START_POINT: number;
                IN_PROGRESS: number;
                COMPLETION: number;
            }>;
            byPriority: z.ZodObject<{
                Critical: z.ZodNumber;
                High: z.ZodNumber;
                Medium: z.ZodNumber;
                Low: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                Critical: number;
                High: number;
                Medium: number;
                Low: number;
            }, {
                Critical: number;
                High: number;
                Medium: number;
                Low: number;
            }>;
            todayCount: z.ZodNumber;
            weekCount: z.ZodNumber;
            averageResponseTime: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            total: number;
            byStatus: {
                red: number;
                yellow: number;
                green: number;
            };
            byWorkflowState: {
                START_POINT: number;
                IN_PROGRESS: number;
                COMPLETION: number;
            };
            byPriority: {
                Critical: number;
                High: number;
                Medium: number;
                Low: number;
            };
            todayCount: number;
            weekCount: number;
            averageResponseTime?: number | undefined;
        }, {
            total: number;
            byStatus: {
                red: number;
                yellow: number;
                green: number;
            };
            byWorkflowState: {
                START_POINT: number;
                IN_PROGRESS: number;
                COMPLETION: number;
            };
            byPriority: {
                Critical: number;
                High: number;
                Medium: number;
                Low: number;
            };
            todayCount: number;
            weekCount: number;
            averageResponseTime?: number | undefined;
        }>;
    };
    readonly websocket: {
        readonly path: "/ws/emails";
        readonly events: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"email.update">;
            data: z.ZodObject<{
                id: z.ZodString;
                email_alias: z.ZodString;
                requested_by: z.ZodString;
                subject: z.ZodString;
                summary: z.ZodString;
                status: z.ZodEnum<["red", "yellow", "green"]>;
                status_text: z.ZodString;
                workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
                timestamp: z.ZodString;
                priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
                workflow_type: z.ZodOptional<z.ZodString>;
                entities: z.ZodOptional<z.ZodObject<{
                    po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "strip", z.ZodTypeAny, {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                }, {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                }>>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                assignedTo: z.ZodOptional<z.ZodString>;
                dueDate: z.ZodOptional<z.ZodString>;
                lastUpdated: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }, {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            data: {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            };
            type: "email.update";
        }, {
            data: {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            };
            type: "email.update";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"email.create">;
            data: z.ZodObject<{
                id: z.ZodString;
                email_alias: z.ZodString;
                requested_by: z.ZodString;
                subject: z.ZodString;
                summary: z.ZodString;
                status: z.ZodEnum<["red", "yellow", "green"]>;
                status_text: z.ZodString;
                workflow_state: z.ZodEnum<["START_POINT", "IN_PROGRESS", "COMPLETION"]>;
                timestamp: z.ZodString;
                priority: z.ZodOptional<z.ZodEnum<["Critical", "High", "Medium", "Low"]>>;
                workflow_type: z.ZodOptional<z.ZodString>;
                entities: z.ZodOptional<z.ZodObject<{
                    po_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    quote_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    case_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    part_numbers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    customers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    order_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                }, "strip", z.ZodTypeAny, {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                }, {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                }>>;
                isRead: z.ZodOptional<z.ZodBoolean>;
                hasAttachments: z.ZodOptional<z.ZodBoolean>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                assignedTo: z.ZodOptional<z.ZodString>;
                dueDate: z.ZodOptional<z.ZodString>;
                lastUpdated: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }, {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            data: {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            };
            type: "email.create";
        }, {
            data: {
                timestamp: string;
                summary: string;
                subject: string;
                id: string;
                status: "red" | "yellow" | "green";
                workflow_state: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                email_alias: string;
                requested_by: string;
                status_text: string;
                tags?: string[] | undefined;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                entities?: {
                    customers?: string[] | undefined;
                    po_numbers?: string[] | undefined;
                    quote_numbers?: string[] | undefined;
                    case_numbers?: string[] | undefined;
                    part_numbers?: string[] | undefined;
                    order_references?: string[] | undefined;
                } | undefined;
                lastUpdated?: string | undefined;
                hasAttachments?: boolean | undefined;
                assignedTo?: string | undefined;
                workflow_type?: string | undefined;
                isRead?: boolean | undefined;
                dueDate?: string | undefined;
            };
            type: "email.create";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"email.delete">;
            data: z.ZodObject<{
                id: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                id: string;
            }, {
                id: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            data: {
                id: string;
            };
            type: "email.delete";
        }, {
            data: {
                id: string;
            };
            type: "email.delete";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"stats.update">;
            data: z.ZodObject<{
                total: z.ZodOptional<z.ZodNumber>;
                byStatus: z.ZodOptional<z.ZodObject<{
                    red: z.ZodNumber;
                    yellow: z.ZodNumber;
                    green: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    red: number;
                    yellow: number;
                    green: number;
                }, {
                    red: number;
                    yellow: number;
                    green: number;
                }>>;
                byWorkflowState: z.ZodOptional<z.ZodObject<{
                    START_POINT: z.ZodNumber;
                    IN_PROGRESS: z.ZodNumber;
                    COMPLETION: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                }, {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                }>>;
                byPriority: z.ZodOptional<z.ZodObject<{
                    Critical: z.ZodNumber;
                    High: z.ZodNumber;
                    Medium: z.ZodNumber;
                    Low: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                }, {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                }>>;
                todayCount: z.ZodOptional<z.ZodNumber>;
                weekCount: z.ZodOptional<z.ZodNumber>;
                averageResponseTime: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "strip", z.ZodTypeAny, {
                total?: number | undefined;
                averageResponseTime?: number | undefined;
                byStatus?: {
                    red: number;
                    yellow: number;
                    green: number;
                } | undefined;
                byWorkflowState?: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                } | undefined;
                byPriority?: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                } | undefined;
                todayCount?: number | undefined;
                weekCount?: number | undefined;
            }, {
                total?: number | undefined;
                averageResponseTime?: number | undefined;
                byStatus?: {
                    red: number;
                    yellow: number;
                    green: number;
                } | undefined;
                byWorkflowState?: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                } | undefined;
                byPriority?: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                } | undefined;
                todayCount?: number | undefined;
                weekCount?: number | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            data: {
                total?: number | undefined;
                averageResponseTime?: number | undefined;
                byStatus?: {
                    red: number;
                    yellow: number;
                    green: number;
                } | undefined;
                byWorkflowState?: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                } | undefined;
                byPriority?: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                } | undefined;
                todayCount?: number | undefined;
                weekCount?: number | undefined;
            };
            type: "stats.update";
        }, {
            data: {
                total?: number | undefined;
                averageResponseTime?: number | undefined;
                byStatus?: {
                    red: number;
                    yellow: number;
                    green: number;
                } | undefined;
                byWorkflowState?: {
                    START_POINT: number;
                    IN_PROGRESS: number;
                    COMPLETION: number;
                } | undefined;
                byPriority?: {
                    Critical: number;
                    High: number;
                    Medium: number;
                    Low: number;
                } | undefined;
                todayCount?: number | undefined;
                weekCount?: number | undefined;
            };
            type: "stats.update";
        }>]>;
    };
};
export type EmailDashboardRouter = {
    email: {
        list: {
            input: ListEmailsRequest;
            output: ListEmailsResponse;
        };
        getById: {
            input: string;
            output: GetEmailResponse;
        };
        update: {
            input: {
                id: string;
                data: UpdateEmailRequest;
            };
            output: EmailRecord;
        };
        bulkUpdate: {
            input: BulkUpdateEmailsRequest;
            output: {
                updated: number;
            };
        };
        delete: {
            input: string;
            output: {
                success: boolean;
            };
        };
        export: {
            input: ExportEmailsRequest;
            output: {
                url: string;
            };
        };
        getFilterOptions: {
            output: GetFilterOptionsResponse;
        };
        getStats: {
            output: DashboardStats;
        };
    };
    filterPreset: {
        list: {
            output: FilterPreset[];
        };
        create: {
            input: CreateFilterPresetRequest;
            output: FilterPreset;
        };
        update: {
            input: {
                id: string;
                data: Partial<CreateFilterPresetRequest>;
            };
            output: FilterPreset;
        };
        delete: {
            input: string;
            output: {
                success: boolean;
            };
        };
    };
};
//# sourceMappingURL=email-dashboard-api.d.ts.map
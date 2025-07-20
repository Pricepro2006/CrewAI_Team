import React, { useMemo, useState, useCallback } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type Table as TanstackTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusIndicator } from './StatusIndicator';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { EmailRecord, SortableColumn, SortDirection } from '@/types/email-dashboard.interfaces';

interface EmailTableProps {
  emails: EmailRecord[];
  loading?: boolean;
  error?: string | null;
  selectedEmails?: string[];
  onEmailSelect?: (emailId: string) => void;
  onEmailsSelect?: (emailIds: string[]) => void;
  onSort?: (column: SortableColumn, direction: SortDirection) => void;
  onRowClick?: (email: EmailRecord) => void;
  className?: string;
}

export function EmailTable({
  emails,
  loading = false,
  error = null,
  selectedEmails = [],
  onEmailSelect,
  onEmailsSelect,
  onSort,
  onRowClick,
  className,
}: EmailTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Convert selected emails array to row selection object
  const rowSelectionFromProps = useMemo(() => {
    const selection: RowSelectionState = {};
    selectedEmails.forEach((id) => {
      const index = emails.findIndex((email) => email.id === id);
      if (index !== -1) {
        selection[index] = true;
      }
    });
    return selection;
  }, [selectedEmails, emails]);

  // Sync row selection with props
  React.useEffect(() => {
    setRowSelection(rowSelectionFromProps);
  }, [rowSelectionFromProps]);

  const columns = useMemo<ColumnDef<EmailRecord>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }: { table: TanstackTable<EmailRecord> }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusIndicator
            status={row.original.status}
            statusText={row.original.status_text}
            size="md"
            showPulse={row.original.status === 'red'}
            showTooltip
          />
        ),
        size: 80,
      },
      {
        accessorKey: 'email_alias',
        header: 'Email Alias',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-sm truncate max-w-[200px]">
              {row.original.email_alias.split('@')[0]}
            </span>
            <span className="text-xs text-muted-foreground">
              @{row.original.email_alias.split('@')[1]}
            </span>
          </div>
        ),
        size: 220,
      },
      {
        accessorKey: 'requested_by',
        header: 'Requested By',
        cell: ({ row }) => (
          <div className="font-medium text-sm">{row.original.requested_by}</div>
        ),
        size: 150,
      },
      {
        accessorKey: 'subject',
        header: 'Subject',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm line-clamp-1">{row.original.subject}</span>
            {row.original.hasAttachments && (
              <svg
                className="w-4 h-4 text-muted-foreground flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            )}
          </div>
        ),
        size: 300,
      },
      {
        accessorKey: 'summary',
        header: 'Summary',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground line-clamp-2">
            {row.original.summary}
          </div>
        ),
        size: 350,
      },
      {
        accessorKey: 'timestamp',
        header: 'Time',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(row.original.timestamp), { addSuffix: true })}
          </div>
        ),
        size: 120,
      },
    ],
    []
  );

  const table = useReactTable({
    data: emails,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: (updater) => {
      setSorting(updater);
      // Call external sort handler if provided
      if (onSort && typeof updater === 'function') {
        const newSorting = updater(sorting);
        if (newSorting.length > 0 && newSorting[0]) {
          const { id, desc } = newSorting[0];
          onSort(id as SortableColumn, desc ? 'desc' : 'asc');
        }
      }
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater);
      // Call external selection handler if provided
      if (onEmailsSelect && typeof updater === 'function') {
        const newSelection = updater(rowSelection);
        const selectedIds = Object.keys(newSelection)
          .filter((key) => newSelection[key])
          .map((index) => emails[parseInt(index)]?.id)
          .filter((id): id is string => id !== undefined);
        onEmailsSelect(selectedIds);
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const handleRowClick = useCallback(
    (email: EmailRecord, event: React.MouseEvent) => {
      // Don't trigger row click if clicking on checkbox
      const target = event.target as HTMLElement;
      if (target.closest('[role="checkbox"]')) {
        return;
      }
      onRowClick?.(email);
    },
    [onRowClick]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading emails...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg
            className="w-12 h-12 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-semibold text-lg">Error loading emails</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg
            className="w-12 h-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <div>
            <p className="font-semibold text-lg">No emails found</p>
            <p className="text-muted-foreground">
              Try adjusting your filters or check back later
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="bg-muted/50"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    'hover:bg-muted/50',
                    row.original.isRead === false && 'font-semibold'
                  )}
                  onClick={(e: React.MouseEvent) => handleRowClick(row.original, e)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
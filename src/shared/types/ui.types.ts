/**
 * UI-Specific Types for React Components
 * Comprehensive TypeScript interfaces for UI layer components
 */

import type { ComponentType, ReactNode, SyntheticEvent, MouseEvent, ChangeEvent, KeyboardEvent, FocusEvent, ErrorInfo, CSSProperties } from 'react';

// Base UI Component Types
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

export interface LoadingProps extends BaseComponentProps {
  isLoading?: boolean;
  loadingText?: string;
}

export interface ErrorProps extends BaseComponentProps {
  error?: Error | string | null;
  onRetry?: () => void;
}

// Form and Input Types
export interface FormFieldProps extends BaseComponentProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  helperText?: string;
}

export interface TextInputProps extends FormFieldProps {
  type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'tel';
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  maxLength?: number;
  pattern?: string;
  autoComplete?: string;
}

export interface TextAreaProps extends FormFieldProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  cols?: number;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
}

export interface SelectProps<T = string> extends FormFieldProps {
  value: T;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  multiple?: boolean;
}

export interface CheckboxProps extends FormFieldProps {
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
}

export interface RadioProps extends FormFieldProps {
  value: string;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

// Button Types
export interface ButtonProps extends BaseComponentProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLButtonElement>) => void;
}

// Modal and Dialog Types
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

export interface DialogProps extends ModalProps {
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Table Types
export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T | string;
  header: string;
  accessor?: string | ((row: T) => unknown);
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  render?: (value: unknown, row: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface TableProps<T = Record<string, unknown>> extends BaseComponentProps {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T, index: number) => void;
  selectedRows?: Set<string | number>;
  onRowSelect?: (rowId: string | number, selected: boolean) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}

// Chart and Visualization Types
export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
  type?: 'line' | 'bar' | 'area' | 'scatter' | 'pie';
}

export interface ChartProps extends BaseComponentProps {
  data: ChartSeries[];
  width?: number | string;
  height?: number | string;
  title?: string;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  responsive?: boolean;
  colors?: string[];
  onDataPointClick?: (point: ChartDataPoint, series: ChartSeries) => void;
}

// Navigation Types
export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string | number;
  children?: NavItem[];
  disabled?: boolean;
  external?: boolean;
}

export interface NavigationProps extends BaseComponentProps {
  items: NavItem[];
  activeItem?: string;
  onItemClick?: (item: NavItem) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbProps extends BaseComponentProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  onItemClick?: (item: BreadcrumbItem) => void;
}

// Toast and Notification Types
export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    style?: 'primary' | 'secondary';
  }>;
}

export interface ToastProviderProps {
  children: ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

// Dropdown and Menu Types
export interface DropdownItem {
  id: string;
  label: string;
  value?: unknown;
  icon?: ReactNode;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

export interface DropdownProps extends BaseComponentProps {
  trigger: ReactNode;
  items: DropdownItem[];
  placement?: 'top' | 'bottom' | 'left' | 'right';
  closeOnSelect?: boolean;
  disabled?: boolean;
  onItemSelect?: (item: DropdownItem) => void;
}

// Search and Filter Types
export interface SearchProps extends BaseComponentProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  showClearButton?: boolean;
  loading?: boolean;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}

export interface FilterOption {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'boolean';
  options?: Array<{ value: unknown; label: string }>;
  value?: unknown;
  placeholder?: string;
}

export interface FilterProps extends BaseComponentProps {
  filters: FilterOption[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onApply?: (filters: Record<string, unknown>) => void;
  onReset?: () => void;
  showApplyButton?: boolean;
  showResetButton?: boolean;
}

// Card and Panel Types
export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  hoverable?: boolean;
  clickable?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

export interface PanelProps extends BaseComponentProps {
  title?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  headerActions?: ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
}

// Tab Types
export interface TabItem {
  id: string;
  label: string;
  content?: ReactNode;
  disabled?: boolean;
  badge?: string | number;
  icon?: ReactNode;
}

export interface TabsProps extends BaseComponentProps {
  items: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underlined';
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
}

// Progress Types
export interface ProgressProps extends BaseComponentProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export interface SpinnerProps extends BaseComponentProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'secondary';
  label?: string;
}

// Layout Types
export interface GridProps extends BaseComponentProps {
  cols?: number;
  gap?: number | string;
  responsive?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export interface FlexProps extends BaseComponentProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: number | string;
}

// Event Handler Types
export type UIEventHandler<T = Element> = (event: SyntheticEvent<T>) => void;
export type UIMouseEventHandler<T = Element> = (event: MouseEvent<T>) => void;
export type UIKeyboardEventHandler<T = Element> = (event: KeyboardEvent<T>) => void;
export type UIChangeEventHandler<T = Element> = (event: ChangeEvent<T>) => void;
export type UIFocusEventHandler<T = Element> = (event: FocusEvent<T>) => void;

// Component State Types
export interface ComponentState {
  loading: boolean;
  error: Error | null;
  data: unknown;
}

export interface AsyncComponentState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

// Hook Return Types
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseFormResult<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  setValue: (field: keyof T, value: T[keyof T]) => void;
  setError: (field: keyof T, error: string) => void;
  setTouched: (field: keyof T, touched: boolean) => void;
  handleSubmit: (onSubmit: (values: T) => void) => (event?: SyntheticEvent) => void;
  reset: () => void;
  isValid: boolean;
  isDirty: boolean;
}

// WebSocket and Real-time Types
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
  id?: string;
}

export interface UseWebSocketResult<T = unknown> {
  lastMessage: WebSocketMessage<T> | null;
  sendMessage: (message: WebSocketMessage<T>) => void;
  readyState: number;
  connect: () => void;
  disconnect: () => void;
}

// Error Boundary Types
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<{ error: Error; errorInfo: ErrorInfo; reset: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

// Theme and Styling Types
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };
  border: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: Record<string, string>;
  typography: Record<string, CSSProperties>;
  breakpoints: Record<string, string>;
  shadows: Record<string, string>;
  borderRadius: Record<string, string>;
  zIndex: Record<string, number>;
}

export interface ThemeProviderProps {
  theme: Theme;
  children: ReactNode;
}

// Utility Types for UI Components
export type Variant = 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error' | 'info';
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Position = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type Alignment = 'start' | 'center' | 'end' | 'stretch';

// Generic component wrapper types
export interface WithLoading<T> {
  loading?: boolean;
}

export interface WithError<T> {
  error?: Error | string | null;
}

export type WithOptional<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: T[P];
};

// Type guards for UI components
export function isReactElement(value: unknown): value is ReactNode {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}
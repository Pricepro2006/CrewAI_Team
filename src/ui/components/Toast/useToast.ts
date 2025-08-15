import { useCallback } from "react";

export interface ToastOptions {
  duration?: number; // 0 means no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  persist?: boolean;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  options?: ToastOptions;
  timestamp: Date;
}

// Global toast manager
class ToastManager {
  private listeners: Set<(toasts: Toast[]) => void> = new Set();
  private toasts: Toast[] = [];
  private maxToasts = 5;

  subscribe(listener: (toasts: Toast[]) => void) {
    this?.listeners?.add(listener);
    listener(this.toasts);
    return () => {
      this?.listeners?.delete(listener);
    };
  }

  private notify() {
    this?.listeners?.forEach((listener: any) => listener(this.toasts));
  }

  add(
    type: Toast["type"],
    message: string,
    options?: ToastOptions
  ): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toast: Toast = {
      id,
      type,
      message,
      options,
      timestamp: new Date(),
    };

    // Add new toast and limit to maxToasts
    this.toasts = [toast, ...this.toasts].slice(0, this.maxToasts);
    this.notify();

    // Auto-dismiss if duration is set and not 0
    if (options?.duration !== 0) {
      const duration = options?.duration || 5000;
      setTimeout(() => {
        this.remove(id);
        options?.onDismiss?.();
      }, duration);
    }

    return id;
  }

  remove(id: string) {
    this.toasts = this?.toasts?.filter((t: any) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  update(id: string, updates: Partial<Toast>) {
    this.toasts = this?.toasts?.map((t: any) =>
      t.id === id ? { ...t, ...updates } : t
    );
    this.notify();
  }
}

// Global instance
const toastManager = new ToastManager();

// Hook for components to use toasts
export function useToast() {
  const show = useCallback(
    (type: Toast["type"], message: string, options?: ToastOptions) => {
      return toastManager.add(type, message, options);
    },
    []
  );

  const success = useCallback(
    (message: string, options?: ToastOptions) => show("success", message, options),
    [show]
  );

  const error = useCallback(
    (message: string, options?: ToastOptions) => show("error", message, options),
    [show]
  );

  const warning = useCallback(
    (message: string, options?: ToastOptions) => show("warning", message, options),
    [show]
  );

  const info = useCallback(
    (message: string, options?: ToastOptions) => show("info", message, options),
    [show]
  );

  const dismiss = useCallback((id: string) => {
    toastManager.remove(id);
  }, []);

  const clear = useCallback(() => {
    toastManager.clear();
  }, []);

  return {
    show,
    success,
    error,
    warning,
    info,
    dismiss,
    clear,
  };
}

// Static methods for use outside of React components
export const toast = {
  success: (message: string, options?: ToastOptions) =>
    toastManager.add("success", message, options),
  error: (message: string, options?: ToastOptions) =>
    toastManager.add("error", message, options),
  warning: (message: string, options?: ToastOptions) =>
    toastManager.add("warning", message, options),
  info: (message: string, options?: ToastOptions) =>
    toastManager.add("info", message, options),
  dismiss: (id: string) => toastManager.remove(id),
  clear: () => toastManager.clear(),
};

// Export the manager for the ToastContainer to subscribe to
export { toastManager };
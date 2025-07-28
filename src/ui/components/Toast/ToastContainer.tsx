import React from 'react';
import { Toast } from './Toast.js';
import type { ToastProps, ToastType } from './Toast.js';
import './ToastContainer.css';

interface ToastData extends Omit<ToastProps, 'onClose'> {
  id: string;
}

interface ToastContainerProps {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  maxToasts?: number;
}

let toastId = 0;
let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null;

export function ToastContainer({ position = 'top-right', maxToasts = 5 }: ToastContainerProps) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  React.useEffect(() => {
    addToastFn = (toast: Omit<ToastData, 'id'>) => {
      const id = `toast-${++toastId}`;
      setToasts(prev => {
        const newToasts = [...prev, { ...toast, id }];
        // Remove oldest toast if exceeding maxToasts
        if (newToasts.length > maxToasts) {
          return newToasts.slice(-maxToasts);
        }
        return newToasts;
      });
    };

    return () => {
      addToastFn = null;
    };
  }, [maxToasts]);

  const handleClose = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className={`toast-container toast-container-${position}`}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={handleClose}
        />
      ))}
    </div>
  );
}

// Toast API
export const toast = {
  show: (options: Omit<ToastData, 'id' | 'type'> & { type?: ToastType }) => {
    if (addToastFn) {
      addToastFn({ type: 'info', ...options });
    }
  },
  success: (title: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title'>>) => {
    if (addToastFn) {
      addToastFn({ type: 'success', title, ...options });
    }
  },
  error: (title: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title'>>) => {
    if (addToastFn) {
      addToastFn({ type: 'error', title, duration: 0, ...options });
    }
  },
  warning: (title: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title'>>) => {
    if (addToastFn) {
      addToastFn({ type: 'warning', title, ...options });
    }
  },
  info: (title: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title'>>) => {
    if (addToastFn) {
      addToastFn({ type: 'info', title, ...options });
    }
  },
};

// Helper hook for easy toast usage
export function useToast() {
  return toast;
}
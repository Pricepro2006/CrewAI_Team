import React from 'react';
import { clsx } from 'clsx';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className
}) => {
  const icons = {
    info: <Info className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    warning: <AlertCircle className="h-4 w-4" />,
    error: <XCircle className="h-4 w-4" />
  };
  
  const styles = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200'
  };
  
  return (
    <div
      className={clsx(
        'flex gap-3 rounded-lg border p-4',
        styles[variant],
        className
      )}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[variant]}</div>
      <div className="flex-1">
        {title && <h3 className="font-medium mb-1">{title}</h3>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};
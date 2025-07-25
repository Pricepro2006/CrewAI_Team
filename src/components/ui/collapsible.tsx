import React, { useState } from 'react';
import { cn } from '../../lib/utils';

interface CollapsibleProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ className, children, open: controlledOpen, onOpenChange, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;

    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            if (child.type === CollapsibleTrigger) {
              return React.cloneElement(child, {
                onClick: () => setOpen(!open),
                'aria-expanded': open
              });
            }
            if (child.type === CollapsibleContent) {
              return React.cloneElement(child, { open });
            }
          }
          return child;
        })}
      </div>
    );
  }
);
Collapsible.displayName = 'Collapsible';

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, children, onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn('flex w-full items-center justify-between py-2 text-left', className)}
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, open, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'overflow-hidden transition-all duration-200',
          open ? 'animate-in slide-in-from-top-1' : 'animate-out slide-out-to-top-1 hidden',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
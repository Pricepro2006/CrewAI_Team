import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionProps {
  type?: 'single' | 'multiple';
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, children, type = 'single', collapsible = false, ...props }, ref) => {
    const [openItems, setOpenItems] = useState<string[]>([]);

    const handleToggle = (value: string) => {
      if (type === 'single') {
        setOpenItems(openItems.includes(value) ? (collapsible ? [] : openItems) : [value]);
      } else {
        setOpenItems(
          openItems.includes(value)
            ? openItems.filter(item => item !== value)
            : [...openItems, value]
        );
      }
    };

    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            const value = child.props.value || `item-${index}`;
            return React.cloneElement(child, {
              isOpen: openItems.includes(value),
              onToggle: () => handleToggle(value),
              value
            });
          }
          return child;
        })}
      </div>
    );
  }
);
Accordion.displayName = 'Accordion';

interface AccordionItemProps {
  value?: string;
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, children, isOpen, onToggle, value, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('border rounded-lg', className)} {...props}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            if (child.type === AccordionTrigger) {
              return React.cloneElement(child, { isOpen, onToggle });
            }
            if (child.type === AccordionContent) {
              return React.cloneElement(child, { isOpen });
            }
          }
          return child;
        })}
      </div>
    );
  }
);
AccordionItem.displayName = 'AccordionItem';

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, isOpen, onToggle, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'flex w-full items-center justify-between p-4 text-left transition-all hover:underline',
          className
        )}
        onClick={onToggle}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, isOpen, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'animate-in slide-in-from-top-1' : 'animate-out slide-out-to-top-1 hidden'
        )}
        {...props}
      >
        <div className={cn('p-4 pt-0', className)}>{children}</div>
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
import React from "react";
import { cn } from "../../lib/utils.js";

interface RadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("grid gap-2", className)}
        role="radiogroup"
        {...props}
      >
        {React?.Children?.map(children, (child: any) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              checked: child?.props?.value === value,
              onChange: () => onValueChange?.(child?.props?.value),
            });
          }
          return child;
        })}
      </div>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

interface RadioGroupItemProps {
  value: string;
  checked?: boolean;
  onChange?: () => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  (
    { className, value, checked, onChange, children, disabled, ...props },
    ref,
  ) => {
    return (
      <label
        className={cn(
          "flex items-center space-x-2 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        <input
          ref={ref}
          type="radio"
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 disabled:cursor-not-allowed"
          {...props}
        />
        {children && <span className="text-sm">{children}</span>}
      </label>
    );
  },
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };

import * as React from "react";
import { cn } from "../../lib/utils";

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

interface TooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

const TooltipContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ children }) => {
  const { setOpen } = React.useContext(TooltipContext);
  
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </div>
  );
};

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, side = 'top', ...props }, ref) => {
    const { open } = React.useContext(TooltipContext);
    
    if (!open) return null;
    
    const positionClasses = {
      top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 px-3 py-1.5 text-sm text-white bg-gray-900 rounded-md shadow-md",
          positionClasses[side],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};

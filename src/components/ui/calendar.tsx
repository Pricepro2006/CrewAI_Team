import * as React from "react";
import { cn } from "../../lib/utils";

interface CalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | { from: Date; to: Date };
  onSelect?: (date: Date | Date[] | { from: Date; to: Date } | undefined) => void;
  className?: string;
  disabled?: (date: Date) => boolean;
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ className, mode = 'single', selected, onSelect, disabled, ...props }, ref) => {
    const [currentDate, setCurrentDate] = React.useState(new Date());
    
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);
    
    const handleDateClick = (day: number) => {
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      if (disabled && disabled(newDate)) return;
      
      if (onSelect) {
        onSelect(newDate);
      }
    };
    
    const isSelected = (day: number) => {
      if (!selected) return false;
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      
      if (selected instanceof Date) {
        return date.toDateString() === selected.toDateString();
      }
      
      return false;
    };
    
    return (
      <div ref={ref} className={cn("p-3", className)} {...props}>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            ←
          </button>
          <h2 className="font-semibold">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            →
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="p-2 font-medium text-gray-500">
              {day}
            </div>
          ))}
          
          {emptyDays.map(i => (
            <div key={`empty-${i}`} className="p-2" />
          ))}
          
          {days.map(day => (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={cn(
                "p-2 hover:bg-gray-100 rounded text-sm",
                isSelected(day) && "bg-primary text-white hover:bg-primary/90",
                disabled && disabled(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)) && "text-gray-300 cursor-not-allowed"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    );
  }
);
Calendar.displayName = "Calendar";

export { Calendar };

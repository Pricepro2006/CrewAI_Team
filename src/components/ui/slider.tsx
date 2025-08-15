import * as React from "react";
import { cn } from "../../lib/utils.js";

interface SliderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value = [0],
      defaultValue = [0],
      min = 0,
      max = 100,
      step = 1,
      onValueChange,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] =
      React.useState<number[]>(defaultValue);
    const currentValue = value || internalValue;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [parseFloat(event?.target?.value)];
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className,
        )}
        {...props}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue[0]}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };

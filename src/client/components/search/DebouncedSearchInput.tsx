import React, { useState, useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "../../hooks/useDebounce";
import { cn } from "../../../lib/utils";

interface DebouncedSearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  initialValue?: string;
  disabled?: boolean;
  showClearButton?: boolean;
  minLength?: number;
}

export const DebouncedSearchInput = React.memo<DebouncedSearchInputProps>(({
  onSearch,
  placeholder = "Search...",
  debounceMs = 300,
  className,
  initialValue = "",
  disabled = false,
  showClearButton = true,
  minLength = 0,
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  
  // Debounce the search query
  const debouncedValue = useDebounce(inputValue, debounceMs);

  // Trigger search when debounced value changes
  React.useEffect(() => {
    if ((debouncedValue?.length || 0) >= minLength) {
      onSearch(debouncedValue);
    } else if ((debouncedValue?.length || 0) === 0) {
      onSearch("");
    }
  }, [debouncedValue, onSearch, minLength]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setInputValue("");
    onSearch("");
  }, [onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClear();
    }
  }, [handleClear]);

  const showClear = showClearButton && (inputValue?.length || 0) > 0;
  const hasMinLengthError = (inputValue?.length || 0) > 0 && (inputValue?.length || 0) < minLength;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search
          className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 transition-colors",
            isFocused && "text-blue-500",
            "h-4 w-4"
          )}
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "disabled:bg-gray-100 disabled:cursor-not-allowed",
            "transition-colors",
            hasMinLengthError && "border-red-300 focus:ring-red-500 focus:border-red-500"
          )}
        />
        {showClear && (
          <button
            onClick={handleClear}
            className={cn(
              "absolute right-3 top-1/2 transform -translate-y-1/2",
              "text-gray-400 hover:text-gray-600 transition-colors",
              "h-4 w-4"
            )}
            type="button"
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Loading indicator */}
      {inputValue !== debouncedValue && (inputValue?.length || 0) >= minLength && (
        <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Error message for minimum length */}
      {hasMinLengthError && (
        <p className="mt-1 text-sm text-red-600">
          Search requires at least {minLength} character{minLength !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
});

DebouncedSearchInput.displayName = "DebouncedSearchInput";
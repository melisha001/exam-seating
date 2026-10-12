import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  helperText?: string;
  unit?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  value,
  min,
  max,
  onChange,
  helperText,
  unit,
}) => {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground tracking-wide">
          {label}
        </label>
        {helperText && (
          <span className="text-[11px] text-muted-foreground">{helperText}</span>
        )}
      </div>

      <div className="flex items-center rounded-xl border border-input bg-background/80 shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none rounded-l-xl transition-colors"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center justify-center text-center">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={handleChange}
            className="w-14 text-center font-bold text-sm bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
          />
          {unit && (
            <span className="text-xs text-muted-foreground font-medium select-none -ml-1">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none rounded-r-xl transition-colors"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>Min: {min}</span>
        <span>Max: {max}</span>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseDateString } from '@/lib/dueUtils';

interface DatePickerProps {
  value: string; // Parent value (YYYY-MM-DD or raw string)
  onChange: (val: string) => void; // Parent setter (receives YYYY-MM-DD or raw text)
  required?: boolean;
  placeholder?: string;
  className?: string;
}

// Converts YYYY-MM-DD to DD-MM-YYYY
function ymdToDmy(ymd: string): string {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return ymd;
}

// Parses a DD-MM-YYYY or YYYY-MM-DD string into YYYY-MM-DD, or returns null if invalid
function parseEnteredDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Try DD-MM-YYYY
  const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  const dmyMatch = trimmed.match(dmyRegex);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  // Try YYYY-MM-DD
  const ymdRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const ymdMatch = trimmed.match(ymdRegex);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  return null;
}

export default function DatePicker({
  value,
  onChange,
  required = false,
  placeholder = 'DD-MM-YYYY',
  className = '',
}: DatePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const YEARS_RANGE = Array.from({ length: 30 }, (_, i) => currentYear - 15 + i);

  // Sync internal display text with parent value
  useEffect(() => {
    if (value) {
      setInputValue(ymdToDmy(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  // Click away listener to close calendar popup
  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // Adjust focused date when year/month changes in calendar dropdowns
  useEffect(() => {
    if (isCalendarOpen && !focusedDate) {
      setFocusedDate(new Date(calendarYear, calendarMonth, 1));
    }
  }, [calendarYear, calendarMonth, isCalendarOpen, focusedDate]);

  const selectDate = (date: Date) => {
    const dStr = String(date.getDate()).padStart(2, '0');
    const mStr = String(date.getMonth() + 1).padStart(2, '0');
    const yStr = date.getFullYear();
    const ymd = `${yStr}-${mStr}-${dStr}`;
    onChange(ymd);
    setInputValue(`${dStr}-${mStr}-${yStr}`);
    setIsCalendarOpen(false);
  };

  const selectToday = () => {
    selectDate(new Date());
  };

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
    setFocusedDate(null);
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
    setFocusedDate(null);
  };

  const handlePayDateChange = (val: string) => {
    setInputValue(val);
    const parsed = parseEnteredDate(val);
    if (parsed) {
      onChange(parsed);
      const d = parseDateString(parsed);
      setCalendarYear(d.getFullYear());
      setCalendarMonth(d.getMonth());
      setFocusedDate(d);
    } else {
      onChange(val); // Keep parent in sync with typed raw text for form validation
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isCalendarOpen) {
      if (e.key === 'ArrowDown') {
        setIsCalendarOpen(true);
        e.preventDefault();
      }
      return;
    }

    const baseDate = focusedDate || new Date(calendarYear, calendarMonth, 1);
    const newDate = new Date(baseDate);

    switch (e.key) {
      case 'Escape':
        setIsCalendarOpen(false);
        e.preventDefault();
        break;
      case 'ArrowLeft':
        newDate.setDate(newDate.getDate() - 1);
        setFocusedDate(newDate);
        setCalendarMonth(newDate.getMonth());
        setCalendarYear(newDate.getFullYear());
        e.preventDefault();
        break;
      case 'ArrowRight':
        newDate.setDate(newDate.getDate() + 1);
        setFocusedDate(newDate);
        setCalendarMonth(newDate.getMonth());
        setCalendarYear(newDate.getFullYear());
        e.preventDefault();
        break;
      case 'ArrowUp':
        newDate.setDate(newDate.getDate() - 7);
        setFocusedDate(newDate);
        setCalendarMonth(newDate.getMonth());
        setCalendarYear(newDate.getFullYear());
        e.preventDefault();
        break;
      case 'ArrowDown':
        newDate.setDate(newDate.getDate() + 7);
        setFocusedDate(newDate);
        setCalendarMonth(newDate.getMonth());
        setCalendarYear(newDate.getFullYear());
        e.preventDefault();
        break;
      case 'Enter':
        if (focusedDate) {
          selectDate(focusedDate);
          e.preventDefault();
        }
        break;
      default:
        break;
    }
  };

  const renderCalendarDays = () => {
    const year = calendarYear;
    const month = calendarMonth;

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const dayElements: React.JSX.Element[] = [];

    const currentParsed = parseEnteredDate(inputValue);
    const currentSelectedDate = currentParsed ? parseDateString(currentParsed) : null;

    for (let i = firstDay - 1; i >= 0; i--) {
      const dNum = prevTotalDays - i;
      const dObj = new Date(year, month - 1, dNum);
      dayElements.push(
        <button
          key={`prev-${dNum}`}
          type="button"
          onClick={() => selectDate(dObj)}
          className="h-8 w-8 text-xs text-slate-600 hover:bg-slate-900 rounded-lg flex items-center justify-center transition"
        >
          {dNum}
        </button>
      );
    }

    for (let d = 1; d <= totalDays; d++) {
      const dObj = new Date(year, month, d);
      const isSelected = currentSelectedDate &&
        currentSelectedDate.getFullYear() === year &&
        currentSelectedDate.getMonth() === month &&
        currentSelectedDate.getDate() === d;

      const isToday = new Date().getFullYear() === year &&
        new Date().getMonth() === month &&
        new Date().getDate() === d;

      const isFocused = focusedDate &&
        focusedDate.getFullYear() === year &&
        focusedDate.getMonth() === month &&
        focusedDate.getDate() === d;

      dayElements.push(
        <button
          key={`curr-${d}`}
          type="button"
          onClick={() => selectDate(dObj)}
          className={`h-8 w-8 text-xs rounded-lg flex items-center justify-center transition font-medium relative ${
            isSelected
              ? 'bg-indigo-600 text-white font-bold'
              : isToday
              ? 'border border-indigo-500/50 text-indigo-400 font-bold'
              : 'text-slate-300 hover:bg-slate-900'
          } ${isFocused ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''}`}
        >
          {d}
          {isToday && !isSelected && (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 bg-indigo-400 rounded-full" />
          )}
        </button>
      );
    }

    const remainingSlots = 42 - dayElements.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const dObj = new Date(year, month + 1, d);
      dayElements.push(
        <button
          key={`next-${d}`}
          type="button"
          onClick={() => selectDate(dObj)}
          className="h-8 w-8 text-xs text-slate-600 hover:bg-slate-900 rounded-lg flex items-center justify-center transition"
        >
          {d}
        </button>
      );
    }

    return dayElements;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} id="date-picker-container">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Calendar className="h-4 w-4" />
        </div>
        <input
          type="text"
          required={required}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => handlePayDateChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsCalendarOpen(true)}
          className="block w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar Popup */}
      {isCalendarOpen && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl animate-scale-up left-0 sm:left-auto sm:right-0">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1">
              <select
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(parseInt(e.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i} className="bg-slate-900 text-slate-200">{name}</option>
                ))}
              </select>
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(parseInt(e.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer"
              >
                {YEARS_RANGE.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-slate-200">{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 my-2">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendarDays()}
          </div>

          {/* Quick buttons */}
          <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-900 text-xs">
            <button
              type="button"
              onClick={selectToday}
              className="text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(false)}
              className="text-slate-500 hover:text-slate-300 font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

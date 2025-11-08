import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  className?: string;
  style?: React.CSSProperties;
  validationError?: boolean;
  required?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  name,
  value,
  onChange,
  options,
  className,
  style,
  validationError,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const handleSelect = (optionValue: string) => {
    onChange({
      target: { name, value: optionValue },
    } as React.ChangeEvent<HTMLSelectElement>);
    setIsOpen(false);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const displayValue = options.find(option => option.value === value)?.label || (options.length > 0 ? options[0].label : '');

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        id={id}
        className={`w-full pl-4 pr-10 py-3 rounded-lg border transition-all duration-200 font-inter text-left focus:outline-none ${className} ${validationError ? 'border-red-500' : ''}`}
        style={style}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
      >
        {displayValue}
      </button>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </div>

      {isOpen && (
        <ul
          className="absolute z-10 w-full mt-1 rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none overflow-auto"
          style={{ backgroundColor: style?.backgroundColor || '#f6f6f4' }}
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {options.map((option) => (
            <li
              key={option.value}
              className={`text-gray-900 cursor-default select-none relative py-2 pl-4 pr-9 ${
                option.value === value ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
              style={{ backgroundColor: style?.backgroundColor || '#f6f6f4' }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {/* Hidden native select for form submission and accessibility fallback */}
      <select
        id={`${id}-native`}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="sr-only" // Visually hide but keep for form submission and accessibility
        tabIndex={-1} // Prevent focus
        aria-hidden="true" // Hide from accessibility tree
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};

export default CustomSelect;


import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; id?: string }> = ({ children, className = "", onClick, id }) => (
  <div id={id} onClick={onClick} className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary', className = "", disabled = false }) => {
  // v17 Style: Gradient buttons, rounded-xl, shadow
  const baseStyle = "px-6 py-2.5 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";
  
  const variants: Record<string, string> = {
    // Gradient Indigo-Blue style
    primary: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-500/20",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 font-medium"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "blue" }) => {
    const colors: Record<string, string> = {
        blue: "bg-indigo-100 text-indigo-700 border border-indigo-200",
        green: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        yellow: "bg-amber-100 text-amber-700 border border-amber-200",
        purple: "bg-purple-100 text-purple-700 border border-purple-200",
        red: "bg-rose-100 text-rose-700 border border-rose-200",
        gray: "bg-gray-100 text-gray-700 border border-gray-200"
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${colors[color] || colors.gray}`}>
            {children}
        </span>
    );
};

interface MultiSelectProps {
  options: number[];
  selected: number[];
  onChange: (selected: number[]) => void;
  label: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: number) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option].sort((a, b) => a - b));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white cursor-pointer flex justify-between items-center text-sm shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all"
      >
        <span className={selected.length === 0 ? "text-gray-400" : "text-gray-800 font-medium"}>
          {selected.length === 0 ? label : `Seçilen: ${selected.join(', ')}`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto py-1">
          {options.length === 0 ? (
             <div className="p-3 text-xs text-gray-500 text-center">Liste boş. Önce personel ekleyin.</div>
          ) : (
             options.map(option => (
                <div 
                  key={option} 
                  onClick={() => toggleOption(option)}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm transition-colors"
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${selected.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={selected.includes(option) ? 'text-indigo-900 font-medium' : 'text-gray-700'}>Kıdem {option}</span>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};

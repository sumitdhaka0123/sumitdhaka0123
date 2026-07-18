import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  options: (string | Option)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className = '',
  required = false,
  disabled = false,
  id,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize options to object shape
  const normalizedOptions = useMemo<Option[]>(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Sort options so that those matching the search query appear on top
  const sortedOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return normalizedOptions;
    }

    const query = searchQuery.toLowerCase().trim();

    // Partition options based on match relevance
    const exactPrefixMatches: Option[] = [];
    const substringMatches: Option[] = [];
    const noMatches: Option[] = [];

    normalizedOptions.forEach((opt) => {
      const labelLower = opt.label.toLowerCase();
      const valueLower = opt.value.toLowerCase();

      if (labelLower.startsWith(query) || valueLower.startsWith(query)) {
        exactPrefixMatches.push(opt);
      } else if (labelLower.includes(query) || valueLower.includes(query)) {
        substringMatches.push(opt);
      } else {
        noMatches.push(opt);
      }
    });

    // Combine them so that: prefix matches -> substring matches -> rest of the options
    return [...exactPrefixMatches, ...substringMatches, ...noMatches];
  }, [normalizedOptions, searchQuery]);

  // Find label of currently selected option
  const selectedOptionLabel = useMemo(() => {
    const found = normalizedOptions.find((opt) => opt.value === value);
    return found ? found.label : '';
  }, [normalizedOptions, value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync highlighted index when options sort/filter or query changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % sortedOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + sortedOptions.length) % sortedOptions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (sortedOptions[highlightedIndex]) {
          handleSelect(sortedOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      id={id}
    >
      <div
        className={`flex items-center justify-between bg-white border rounded-2xl p-3 text-base sm:text-xs transition-all duration-200 outline-none cursor-pointer ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:border-slate-300'
        } ${isOpen ? 'border-cyan-500 ring-2 ring-cyan-500/10' : 'border-slate-200'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        <span className={`block truncate font-sans ${value ? 'text-slate-800 font-medium' : 'text-slate-400 font-normal'}`}>
          {selectedOptionLabel || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'transform rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 1, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden font-sans"
          >
            {/* Search Input Box */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search & sort..."
                className="w-full bg-transparent text-sm sm:text-xs text-slate-800 placeholder-slate-400 outline-none border-none p-0 font-sans focus:ring-0"
              />
            </div>

            {/* List of Options */}
            <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50">
              {sortedOptions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 text-center font-medium">
                  No options found
                </div>
              ) : (
                sortedOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;
                  const isMatch = searchQuery.trim() && (
                    opt.label.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                    opt.value.toLowerCase().includes(searchQuery.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={opt.value}
                      className={`px-4 py-2.5 sm:py-2 text-sm sm:text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        isHighlighted ? 'bg-cyan-50/70 text-cyan-900' : 'text-slate-700 hover:bg-slate-50'
                      } ${isSelected ? 'bg-cyan-50 font-semibold text-cyan-950' : ''}`}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="truncate font-sans font-medium">{opt.label}</span>
                        {isMatch && (
                          <span className="text-[10px] text-cyan-600 font-extrabold uppercase tracking-wide">
                            Matching Query
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-cyan-600 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// components/ui/DomainTagInput.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface DomainTagInputProps {
  domains: string[];
  onDomainsChange: (domains: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DomainTagInput({
  domains,
  onDomainsChange,
  placeholder = "Enter domain (e.g., company.com)",
  className = '',
  disabled = false,
}: DomainTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Domain validation regex - blocks invalid characters in real-time
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.?[a-zA-Z0-9-]*$/;

  const validateDomain = (domain: string): boolean => {
    // Full domain validation
    const fullDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
    return fullDomainRegex.test(domain);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Real-time sanitization - block invalid characters
    if (domainRegex.test(value)) {
      setInputValue(value);
      setError(null);
    } else {
      // Only allow valid characters
      const sanitized = value.replace(/[^a-zA-Z0-9.-]/g, '');
      setInputValue(sanitized);
      setError('Invalid domain characters');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addDomain();
    } else if (e.key === 'Backspace' && inputValue === '' && domains.length > 0) {
      // Remove last tag on backspace when input is empty
      removeDomain(domains[domains.length - 1]);
    }
  };

  const addDomain = () => {
    const domain = inputValue.trim().toLowerCase();
    
    if (!domain) return;
    
    if (domains.includes(domain)) {
      setError('Domain already added');
      return;
    }
    
    if (!validateDomain(domain)) {
      setError('Invalid domain format (e.g., company.com)');
      return;
    }
    
    onDomainsChange([...domains, domain]);
    setInputValue('');
    setError(null);
  };

  const removeDomain = (domainToRemove: string) => {
    onDomainsChange(domains.filter(d => d !== domainToRemove));
  };

  // Auto-focus input when clicking on container
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`flex flex-wrap items-center gap-2 p-3 border rounded-lg min-h-[50px] cursor-text transition-colors ${
          error ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10' : 'border-border bg-card hover:border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={disabled ? undefined : handleContainerClick}
      >
        {domains.map((domain) => (
          <span
            key={domain}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 rounded-full text-sm"
          >
            @{domain}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeDomain(domain);
              }}
              className="hover:text-blue-600 dark:text-blue-300 focus:outline-none"
              disabled={disabled}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={addDomain}
          placeholder={domains.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[150px] outline-none text-sm bg-transparent disabled:cursor-not-allowed"
          disabled={disabled}
        />
      </div>
      
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>
      )}
      
      {domains.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {domains.length} domain{domains.length !== 1 ? 's' : ''} added
        </p>
      )}
    </div>
  );
}

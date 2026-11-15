// hooks/useDebounceSlugValidation.ts
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

interface SlugValidationResult {
  isValid: boolean;
  isAvailable: boolean;
  message?: string;
  alternatives?: string[];
}

export function useDebounceSlugValidation(
  initialValue: string,
  workspaceId?: string
) {
  const [slug, setSlug] = useState(initialValue);
  const [validation, setValidation] = useState<SlugValidationResult>({
    isValid: true,
    isAvailable: true,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState(initialValue);

  // Debounce slug changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSlug(slug);
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  // Validate slug when debounced value changes
  useEffect(() => {
    const validateSlug = async () => {
      if (!debouncedSlug) {
        setValidation({ isValid: true, isAvailable: true });
        return;
      }

      // Client-side validation
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(debouncedSlug)) {
        setValidation({
          isValid: false,
          isAvailable: false,
          message: 'Slug can only contain lowercase letters, numbers, and hyphens',
        });
        return;
      }

      if (debouncedSlug.length < 3) {
        setValidation({
          isValid: false,
          isAvailable: false,
          message: 'Slug must be at least 3 characters long',
        });
        return;
      }

      // Server-side validation
      setIsValidating(true);
      try {
        const response = await apiRequest('/api/workspace/validate-slug', {
          method: 'POST',
          body: JSON.stringify({ slug: debouncedSlug, workspaceId }),
        });

        if (response.success) {
          setValidation({
            isValid: true,
            isAvailable: response.data.available,
            message: response.data.available ? 'Slug is available' : 'Slug is already taken',
            alternatives: response.data.alternatives,
          });
        } else {
          setValidation({
            isValid: false,
            isAvailable: false,
            message: response.message || 'Validation failed',
          });
        }
      } catch (error) {
        setValidation({
          isValid: true,
          isAvailable: true,
          message: 'Unable to validate slug',
        });
      } finally {
        setIsValidating(false);
      }
    };

    validateSlug();
  }, [debouncedSlug, workspaceId]);

  const updateSlug = useCallback((newSlug: string) => {
    // Auto-sanitize: convert to lowercase and replace spaces with hyphens
    const sanitized = newSlug
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setSlug(sanitized);
  }, []);

  const selectAlternative = useCallback((alternative: string) => {
    setSlug(alternative);
  }, []);

  return {
    slug,
    setSlug: updateSlug,
    validation,
    isValidating,
    selectAlternative,
  };
}

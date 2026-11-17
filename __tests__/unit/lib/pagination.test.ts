// __tests__/unit/lib/pagination.test.ts

import { describe, it, expect } from '@jest/globals';
import {
  parsePaginationParams,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@/lib/pagination';

function sp(query: string) {
  return new URLSearchParams(query);
}

describe('parsePaginationParams', () => {
  it('defaults to page 1 and limit 20 when params absent', () => {
    expect(parsePaginationParams(sp(''))).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it('parses explicit page and limit', () => {
    expect(parsePaginationParams(sp('page=3&limit=50'))).toEqual({
      page: 3,
      limit: 50,
      skip: 100,
    });
  });

  it('computes skip for subsequent pages', () => {
    const result = parsePaginationParams(sp('page=2&limit=20'));
    expect(result).toMatchObject({ skip: 20 });
  });

  it('enforces the maximum limit', () => {
    const result = parsePaginationParams(sp(`limit=${MAX_PAGE_SIZE + 1}`));
    expect(result).toHaveProperty('error');
  });

  it('accepts the maximum limit boundary', () => {
    const result = parsePaginationParams(sp(`limit=${MAX_PAGE_SIZE}`));
    expect(result).toMatchObject({ limit: MAX_PAGE_SIZE });
  });

  it('rejects limit of 0 and negative limits', () => {
    expect(parsePaginationParams(sp('limit=0'))).toHaveProperty('error');
    expect(parsePaginationParams(sp('limit=-5'))).toHaveProperty('error');
  });

  it('rejects non-integer and non-numeric values', () => {
    expect(parsePaginationParams(sp('page=abc'))).toHaveProperty('error');
    expect(parsePaginationParams(sp('page=1.5'))).toHaveProperty('error');
    expect(parsePaginationParams(sp('limit=ten'))).toHaveProperty('error');
    expect(parsePaginationParams(sp('limit=2.5'))).toHaveProperty('error');
  });

  it('rejects page 0 and negative pages', () => {
    expect(parsePaginationParams(sp('page=0'))).toHaveProperty('error');
    expect(parsePaginationParams(sp('page=-1'))).toHaveProperty('error');
  });

  it('rejects empty-string params', () => {
    expect(parsePaginationParams(sp('page=&limit='))).toHaveProperty('error');
  });
});

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  ...crypto,
  randomUUID: () => {
    uuidCounter++;
    return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
  },
});

// Reset UUID counter between tests
afterEach(() => {
  uuidCounter = 0;
});

// Mock navigator.clipboard (configurable so @testing-library/user-event can redefine)
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
  configurable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock HTMLElement.scrollIntoView
HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_API_URL: '',
  },
});

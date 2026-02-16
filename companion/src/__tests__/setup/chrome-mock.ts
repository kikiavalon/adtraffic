import { vi, beforeEach } from 'vitest';

/** In-memory storage backing for chrome.storage.local */
let storageData: Record<string, unknown> = {};

const storageMock = {
  get: vi.fn(
    (
      keysOrDefaults: string | string[] | Record<string, unknown>,
      callback: (result: Record<string, unknown>) => void,
    ) => {
      let result: Record<string, unknown> = {};

      if (typeof keysOrDefaults === 'string') {
        // Single key
        if (keysOrDefaults in storageData) {
          result[keysOrDefaults] = storageData[keysOrDefaults];
        }
      } else if (Array.isArray(keysOrDefaults)) {
        // Array of keys
        for (const key of keysOrDefaults) {
          if (key in storageData) {
            result[key] = storageData[key];
          }
        }
      } else {
        // Object with defaults
        result = { ...keysOrDefaults };
        for (const key of Object.keys(keysOrDefaults)) {
          if (key in storageData) {
            result[key] = storageData[key];
          }
        }
      }

      callback(result);
    },
  ),
  set: vi.fn(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(storageData, items);
      if (callback) callback();
    },
  ),
};

const chromeMock = {
  storage: {
    local: storageMock,
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  tabs: {
    create: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
    },
  },
};

// Install on globalThis so source modules can reference `chrome.*`
Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
});

beforeEach(() => {
  // Reset in-memory storage
  storageData = {};

  // Reset all mock call history but keep implementations
  storageMock.get.mockClear();
  storageMock.set.mockClear();
  chromeMock.runtime.sendMessage.mockClear();
  chromeMock.runtime.onMessage.addListener.mockClear();
  chromeMock.action.setBadgeText.mockClear();
  chromeMock.action.setBadgeBackgroundColor.mockClear();
  chromeMock.tabs.create.mockClear();
  chromeMock.tabs.onUpdated.addListener.mockClear();
});

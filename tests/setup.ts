/**
 * Global test setup file
 * This file runs before all tests
 */

import { expect, afterEach, vi, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Electron APIs
if (typeof window !== "undefined") {
  (window as any).electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    },
  };

  // Mock contextBridge APIs
  (window as any).authAPI = {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    validateSession: vi.fn(),
    verifyPin: vi.fn().mockResolvedValue({ success: true }),
  };

  (window as any).productAPI = {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  (window as any).transactionAPI = {
    create: vi.fn(),
    getById: vi.fn(),
    getAll: vi.fn(),
    refund: vi.fn(),
  };

  (window as any).paymentAPI = {
    initializeReader: vi.fn(),
    getReaderStatus: vi.fn(),
    processCardPayment: vi.fn(),
    cancelPayment: vi.fn(),
  };

  (window as any).printerAPI = {
    getStatus: vi.fn(),
    connect: vi.fn(),
    printReceipt: vi.fn(),
  };

  (window as any).scaleAPI = {
    connect: vi.fn(),
    getWeight: vi.fn(),
    disconnect: vi.fn(),
  };

  (window as any).databaseAPI = {
    backup: vi.fn(),
    restore: vi.fn(),
  };
}

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.HARDWARE_SIMULATION_MODE = "true";

// Mock Electron app for logger (needed for main process tests)
vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === "userData") {
          return "/tmp/test-user-data";
        }
        return "/tmp/test-path";
      }),
      getName: vi.fn(() => "aurswift"),
      getVersion: vi.fn(() => "1.8.0"),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    },
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
});

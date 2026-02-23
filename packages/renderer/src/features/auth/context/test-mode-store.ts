import { useSyncExternalStore } from "react";
import type { User } from "@/types/domain";

const TEST_MODE_STORAGE_KEY = "aurswift:test-mode";

const listeners = new Set<() => void>();
let storageListenerRegistered = false;
let testModeValue = readStoredTestMode();

function readStoredTestMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TEST_MODE_STORAGE_KEY) === "1";
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function ensureStorageListener() {
  if (storageListenerRegistered || typeof window === "undefined") {
    return;
  }

  storageListenerRegistered = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== TEST_MODE_STORAGE_KEY) {
      return;
    }

    const nextValue = event.newValue === "1";
    if (nextValue === testModeValue) {
      return;
    }

    testModeValue = nextValue;
    emitChange();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureStorageListener();

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return testModeValue;
}

export function setTestMode(nextValue: boolean) {
  testModeValue = nextValue;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEST_MODE_STORAGE_KEY, nextValue ? "1" : "0");
  }

  emitChange();
}

export function useTestMode() {
  const testMode = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { testMode, setTestMode };
}

export function createTestModeUser(): User {
  const now = new Date("2026-01-01T00:00:00.000Z").toISOString();

  return {
    id: "test-mode-user",
    username: "testmode",
    firstName: "Test",
    lastName: "Mode",
    businessName: "AurSwift Demo",
    businessId: "test-mode-business",
    primaryRole: {
      id: "test-mode-role-admin",
      name: "admin",
      displayName: "Administrator",
      permissions: [],
      isSystemRole: true,
      isActive: true,
    },
    roleName: "admin",
    isActive: true,
    requiresPinChange: false,
    createdAt: now,
    updatedAt: now,
  };
}

// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Test Utilities for MPT React Components
// Provides helpers for testing components with mock daemon integration

import React, { ReactElement, ReactNode } from "react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { vi } from "vitest";
import { MockDaemon, createMockFetch, MockWebSocket } from "./mock-daemon";
import {
    sessionsMapAtom,
    activeSessionIdAtom,
    wsConnectionStatusAtom,
    isInitializedAtom,
    lastErrorAtom,
} from "../store/session-store";
import type { SessionEntry } from "../store/session-store";
import type { WSConnectionStatus } from "../api/mpt-websocket";

// ============================================================================
// Types
// ============================================================================

export interface MockDaemonContext {
    daemon: MockDaemon;
    mockFetch: ReturnType<typeof createMockFetch>;
    createWebSocket: (url: string) => MockWebSocket;
    cleanup: () => void;
}

export interface TestProviderProps {
    children: ReactNode;
    initialSessions?: Map<string, SessionEntry>;
    activeSessionId?: string | null;
    wsStatus?: WSConnectionStatus;
    isInitialized?: boolean;
    error?: string | null;
}

export interface RenderOptions {
    initialSessions?: Map<string, SessionEntry>;
    activeSessionId?: string | null;
    wsStatus?: WSConnectionStatus;
    isInitialized?: boolean;
    error?: string | null;
    daemon?: MockDaemon;
}

export interface RenderResult {
    container: HTMLElement;
    daemon: MockDaemon;
    store: ReturnType<typeof createStore>;
    rerender: (ui: ReactElement) => void;
    unmount: () => void;
}

// ============================================================================
// Mock Daemon Setup
// ============================================================================

/**
 * Creates a complete mock daemon context with fetch and WebSocket mocking
 */
export function setupMockDaemon(): MockDaemonContext {
    const daemon = new MockDaemon();
    const mockFetch = createMockFetch(daemon);

    // Store original globals
    const originalFetch = global.fetch;
    const originalWebSocket = (global as unknown as { WebSocket: typeof WebSocket }).WebSocket;

    // Override globals with proper type assertions for test environment
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
    (global as unknown as { WebSocket: typeof WebSocket }).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
            super(url, daemon);
        }
    } as unknown as typeof WebSocket;

    const createWebSocket = (url: string) => new MockWebSocket(url, daemon);

    const cleanup = () => {
        daemon.reset();
        (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
        (global as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
    };

    return {
        daemon,
        mockFetch,
        createWebSocket,
        cleanup,
    };
}

/**
 * Hook for use in beforeEach/afterEach test lifecycle
 */
export function useMockDaemonSetup() {
    let context: MockDaemonContext | null = null;

    const setup = () => {
        context = setupMockDaemon();
        return context;
    };

    const teardown = () => {
        if (context) {
            context.cleanup();
            context = null;
        }
    };

    return { setup, teardown, getContext: () => context };
}

// ============================================================================
// Test Store Factory
// ============================================================================

/**
 * Creates a Jotai store pre-populated with test data
 */
export function createTestStore(options: RenderOptions = {}): ReturnType<typeof createStore> {
    const store = createStore();

    if (options.initialSessions) {
        store.set(sessionsMapAtom, options.initialSessions);
    }

    if (options.activeSessionId !== undefined) {
        store.set(activeSessionIdAtom, options.activeSessionId);
    }

    if (options.wsStatus) {
        store.set(wsConnectionStatusAtom, options.wsStatus);
    }

    if (options.isInitialized !== undefined) {
        store.set(isInitializedAtom, options.isInitialized);
    }

    if (options.error !== undefined) {
        store.set(lastErrorAtom, options.error);
    }

    return store;
}

// ============================================================================
// Test Provider Component
// ============================================================================

/**
 * Provider component that wraps children with Jotai store and optional initial state
 */
export function TestProvider({
    children,
    initialSessions,
    activeSessionId,
    wsStatus = "disconnected",
    isInitialized = false,
    error = null,
}: TestProviderProps): ReactElement {
    const store = React.useMemo(() => {
        return createTestStore({
            initialSessions,
            activeSessionId,
            wsStatus,
            isInitialized,
            error,
        });
    }, [initialSessions, activeSessionId, wsStatus, isInitialized, error]);

    return <JotaiProvider store={store}>{children}</JotaiProvider>;
}

// ============================================================================
// Mock API Client Factory
// ============================================================================

/**
 * Creates a mock MPT API client for testing
 */
export function createMockAPIClient(daemon: MockDaemon) {
    return {
        health: vi.fn(async () => daemon.health()),
        status: vi.fn(async () => daemon.status().data),
        listSessions: vi.fn(async () => daemon.listSessions().data),
        createSession: vi.fn(async (request: { name: string; connection_type: string; region?: string }) => {
            return daemon.createSession(request.name, request.connection_type, request.region);
        }),
        getSession: vi.fn(async (id: string) => daemon.getSession(id)),
        deleteSession: vi.fn(async (id: string) => daemon.deleteSession(id)),
        reconnectSession: vi.fn(async (id: string) => daemon.reconnectSession(id)),
        execute: vi.fn(async (request: { session_id: string; command: string }) => {
            return daemon.execute(request.session_id, request.command);
        }),
        getOutput: vi.fn(async (sessionId: string, lines?: number) => {
            return daemon.getOutput(sessionId, lines).data;
        }),
        searchOutput: vi.fn(async (sessionId: string, pattern: string) => {
            return daemon.searchOutput(sessionId, pattern).data;
        }),
    };
}

// ============================================================================
// Mock WebSocket Factory
// ============================================================================

/**
 * Creates a mock WebSocket handler for testing
 */
export function createMockWebSocketHandler(daemon: MockDaemon) {
    const callbacks = {
        onOutput: new Map<string, Set<(event: unknown) => void>>(),
        onStatus: new Map<string, Set<(event: unknown) => void>>(),
        onCommand: new Map<string, (event: unknown) => void>(),
        onError: new Set<(code: string, message: string) => void>(),
        onConnection: new Set<(status: WSConnectionStatus) => void>(),
    };

    let status: WSConnectionStatus = "disconnected";
    let ws: MockWebSocket | null = null;

    return {
        connect: vi.fn(async () => {
            status = "connecting";
            callbacks.onConnection.forEach((cb) => cb(status));

            ws = new MockWebSocket("ws://localhost:9876/ws", daemon);

            await new Promise<void>((resolve) => {
                ws!.onopen = () => {
                    status = "connected";
                    callbacks.onConnection.forEach((cb) => cb(status));
                    resolve();
                };
            });
        }),
        disconnect: vi.fn(() => {
            if (ws) {
                ws.close();
                ws = null;
            }
            status = "disconnected";
            callbacks.onConnection.forEach((cb) => cb(status));
        }),
        isConnected: () => status === "connected",
        getStatus: () => status,
        subscribeToSession: vi.fn((sessionId: string) => {
            if (ws) {
                ws.send(JSON.stringify({ type: "subscribe:session", session_id: sessionId }));
            }
            return true;
        }),
        unsubscribeFromSession: vi.fn((sessionId: string) => {
            if (ws) {
                ws.send(JSON.stringify({ type: "unsubscribe:session", session_id: sessionId }));
            }
            return true;
        }),
        executeCommand: vi.fn((sessionId: string, command: string, requestId?: string) => {
            const id = requestId || `cmd_${Date.now()}`;
            if (ws) {
                ws.send(JSON.stringify({
                    type: "execute:command",
                    session_id: sessionId,
                    command,
                    request_id: id,
                }));
            }
            return id;
        }),
        onOutput: vi.fn((sessionId: string, callback: (event: unknown) => void) => {
            if (!callbacks.onOutput.has(sessionId)) {
                callbacks.onOutput.set(sessionId, new Set());
            }
            callbacks.onOutput.get(sessionId)!.add(callback);
            return () => callbacks.onOutput.get(sessionId)?.delete(callback);
        }),
        onStatus: vi.fn((sessionId: string, callback: (event: unknown) => void) => {
            if (!callbacks.onStatus.has(sessionId)) {
                callbacks.onStatus.set(sessionId, new Set());
            }
            callbacks.onStatus.get(sessionId)!.add(callback);
            return () => callbacks.onStatus.get(sessionId)?.delete(callback);
        }),
        onError: vi.fn((callback: (code: string, message: string) => void) => {
            callbacks.onError.add(callback);
            return () => callbacks.onError.delete(callback);
        }),
        onConnectionChange: vi.fn((callback: (status: WSConnectionStatus) => void) => {
            callbacks.onConnection.add(callback);
            callback(status);
            return () => callbacks.onConnection.delete(callback);
        }),
    };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Waits for a condition to be true
 */
export async function waitFor(
    condition: () => boolean,
    { timeout = 5000, interval = 50 } = {}
): Promise<void> {
    const start = Date.now();

    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error(`waitFor timed out after ${timeout}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}

/**
 * Waits for a session to reach a specific status
 */
export async function waitForSessionStatus(
    daemon: MockDaemon,
    sessionId: string,
    status: string,
    timeout = 5000
): Promise<void> {
    await waitFor(() => {
        const session = daemon.getSession(sessionId);
        return session?.status === status;
    }, { timeout });
}

/**
 * Waits for WebSocket connection
 */
export async function waitForConnection(
    ws: MockWebSocket,
    timeout = 5000
): Promise<void> {
    await waitFor(() => ws.readyState === MockWebSocket.OPEN, { timeout });
}

// ============================================================================
// Test Data Factories
// ============================================================================

import type { Session, SessionStatus } from "../api/mpt-api";

export interface CreateSessionOptions {
    id?: string;
    name?: string;
    status?: SessionStatus;
    connection_type?: string;
    region?: string;
    hostname?: string;
    created_at?: string;
    last_activity?: string;
    output?: string[];
    isActive?: boolean;
}

/**
 * Creates a Session object for testing
 */
export function createSession(overrides: Partial<Session> = {}): Session {
    const id = overrides.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    return {
        id,
        name: overrides.name || "Test Session",
        status: overrides.status || "connected",
        connection_type: overrides.connection_type || "od-shellserver",
        region: overrides.region || "prn",
        hostname: overrides.hostname || `devvm001.${overrides.region || "prn"}`,
        created_at: overrides.created_at || now,
        last_activity: overrides.last_activity || now,
        environment: overrides.environment || {
            SITEOPS_TOOLS: true,
            PATH_INCLUDES_SITEOPS: true,
        },
    };
}

/**
 * Creates a session entry for testing (SessionEntry has nested session object)
 */
export function createSessionEntry(options: CreateSessionOptions = {}): SessionEntry {
    const session = createSession({
        id: options.id,
        name: options.name,
        status: options.status,
        connection_type: options.connection_type,
        region: options.region,
        hostname: options.hostname,
        created_at: options.created_at,
        last_activity: options.last_activity,
    });

    return {
        session,
        output: options.output || [],
        lastActivity: options.last_activity || new Date().toISOString(),
        isActive: options.isActive ?? false,
    };
}

/**
 * Creates a map of session entries
 */
export function createSessionsMap(
    sessions: Array<CreateSessionOptions>
): Map<string, SessionEntry> {
    const map = new Map<string, SessionEntry>();

    for (const sessionOpts of sessions) {
        const entry = createSessionEntry(sessionOpts);
        map.set(entry.session.id, entry);
    }

    return map;
}

/**
 * Creates mock output lines
 */
export function createOutputLines(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `Output line ${i + 1}`);
}

// ============================================================================
// Event Simulation Helpers
// ============================================================================

/**
 * Simulates typing in an input element
 */
export function simulateTyping(element: HTMLInputElement, text: string): void {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Simulates pressing Enter key
 */
export function simulateEnter(element: HTMLElement): void {
    element.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
        })
    );
}

/**
 * Simulates a click event
 */
export function simulateClick(element: HTMLElement): void {
    element.dispatchEvent(
        new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
        })
    );
}

// ============================================================================
// Console Helpers
// ============================================================================

/**
 * Suppresses console output during tests
 */
export function suppressConsole() {
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    };

    const suppress = () => {
        console.log = vi.fn();
        console.warn = vi.fn();
        console.error = vi.fn();
    };

    const restore = () => {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    };

    return { suppress, restore };
}

// ============================================================================
// Exports
// ============================================================================

export { MockDaemon, createMockFetch, MockWebSocket, sleep } from "./mock-daemon";

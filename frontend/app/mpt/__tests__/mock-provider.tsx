// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Mock Daemon Provider for React Components
// Provides a React context that injects mock daemon into components for testing

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Provider as JotaiProvider, createStore } from "jotai";
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

export interface MockDaemonProviderProps {
    children: ReactNode;
    autoConnect?: boolean;
    initialSessions?: SessionEntry[];
    activeSessionId?: string | null;
    wsStatus?: WSConnectionStatus;
    isInitialized?: boolean;
}

export interface MockDaemonContextValue {
    daemon: MockDaemon;
    mockFetch: ReturnType<typeof createMockFetch>;
    createSession: (name: string, region?: string) => ReturnType<MockDaemon["createSession"]>;
    execute: (sessionId: string, command: string) => ReturnType<MockDaemon["execute"]>;
    getSession: (id: string) => ReturnType<MockDaemon["getSession"]>;
    deleteSession: (id: string) => boolean;
    createWebSocket: () => MockWebSocket;
    reset: () => void;
}

// ============================================================================
// Context
// ============================================================================

const MockDaemonContext = createContext<MockDaemonContextValue | null>(null);

/**
 * Hook to access mock daemon in tests
 */
export function useMockDaemon(): MockDaemonContextValue {
    const context = useContext(MockDaemonContext);
    if (!context) {
        throw new Error("useMockDaemon must be used within a MockDaemonProvider");
    }
    return context;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Provider that sets up mock daemon and injects it into global fetch/WebSocket
 */
export function MockDaemonProvider({
    children,
    autoConnect = false,
    initialSessions = [],
    activeSessionId = null,
    wsStatus = "disconnected",
    isInitialized = false,
}: MockDaemonProviderProps): React.ReactElement {
    // Create daemon instance
    const daemon = useMemo(() => new MockDaemon(), []);
    const mockFetch = useMemo(() => createMockFetch(daemon), [daemon]);

    // Track original globals
    const [originalFetch] = useState(() => global.fetch);
    const [originalWebSocket] = useState(
        () => (global as unknown as { WebSocket: typeof WebSocket }).WebSocket
    );

    // Create Jotai store with initial state
    const store = useMemo(() => {
        const s = createStore();

        // Set up initial sessions
        if (initialSessions.length > 0) {
            const sessionsMap = new Map<string, SessionEntry>();
            for (const sessionEntry of initialSessions) {
                sessionsMap.set(sessionEntry.session.id, sessionEntry);
            }
            s.set(sessionsMapAtom, sessionsMap);
        }

        if (activeSessionId) {
            s.set(activeSessionIdAtom, activeSessionId);
        }

        s.set(wsConnectionStatusAtom, wsStatus);
        s.set(isInitializedAtom, isInitialized);
        s.set(lastErrorAtom, null);

        return s;
    }, [initialSessions, activeSessionId, wsStatus, isInitialized]);

    // Override globals on mount
    useEffect(() => {
        // Override globals with proper type assertions for test environment
        (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
        (global as unknown as { WebSocket: typeof WebSocket }).WebSocket = class extends MockWebSocket {
            constructor(url: string) {
                super(url, daemon);
            }
        } as unknown as typeof WebSocket;

        // Auto-connect WebSocket if requested
        if (autoConnect) {
            store.set(wsConnectionStatusAtom, "connected");
            store.set(isInitializedAtom, true);
        }

        // Cleanup on unmount
        return () => {
            daemon.reset();
            (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
            (global as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
        };
    }, [daemon, mockFetch, originalFetch, originalWebSocket, autoConnect, store]);

    // Context value with convenience methods
    const contextValue = useMemo<MockDaemonContextValue>(
        () => ({
            daemon,
            mockFetch,
            createSession: (name: string, region = "prn") => {
                return daemon.createSession(name, "od-shellserver", region);
            },
            execute: (sessionId: string, command: string) => {
                return daemon.execute(sessionId, command);
            },
            getSession: (id: string) => daemon.getSession(id),
            deleteSession: (id: string) => daemon.deleteSession(id),
            createWebSocket: () => new MockWebSocket("ws://localhost:9876/ws", daemon),
            reset: () => daemon.reset(),
        }),
        [daemon, mockFetch]
    );

    return (
        <MockDaemonContext.Provider value={contextValue}>
            <JotaiProvider store={store}>{children}</JotaiProvider>
        </MockDaemonContext.Provider>
    );
}

// ============================================================================
// Higher-Order Component
// ============================================================================

/**
 * HOC that wraps a component with MockDaemonProvider
 */
export function withMockDaemon<P extends object>(
    Component: React.ComponentType<P>,
    providerProps: Omit<MockDaemonProviderProps, "children"> = {}
): React.FC<P> {
    return function WrappedComponent(props: P) {
        return (
            <MockDaemonProvider {...providerProps}>
                <Component {...props} />
            </MockDaemonProvider>
        );
    };
}

// ============================================================================
// Test Wrapper Factory
// ============================================================================

/**
 * Creates a wrapper component for use with testing-library
 */
export function createMockDaemonWrapper(
    options: Omit<MockDaemonProviderProps, "children"> = {}
): React.FC<{ children: ReactNode }> {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <MockDaemonProvider {...options}>{children}</MockDaemonProvider>;
    };
}

// ============================================================================
// Pre-configured Wrappers
// ============================================================================

/**
 * Wrapper with connected WebSocket state
 */
export const ConnectedMockDaemonWrapper = createMockDaemonWrapper({
    autoConnect: true,
    wsStatus: "connected",
    isInitialized: true,
});

/**
 * Wrapper with disconnected state (default)
 */
export const DisconnectedMockDaemonWrapper = createMockDaemonWrapper({
    autoConnect: false,
    wsStatus: "disconnected",
    isInitialized: false,
});

/**
 * Wrapper with error state
 */
export const ErrorMockDaemonWrapper = createMockDaemonWrapper({
    autoConnect: false,
    wsStatus: "error",
    isInitialized: true,
});

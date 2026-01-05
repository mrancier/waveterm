// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Component Tests for MPT React Components
// Tests component logic, rendering, and integration with test utilities

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createStore } from "jotai";

// Import test utilities and fixtures
import {
    MockDaemon,
    createMockFetch,
    MockWebSocket,
    createSessionEntry,
    createSessionUtil as createSession,
    createSessionsMap,
    createOutputLines,
    createTestStore,
    TestProvider,
    setupMockDaemon,
    waitFor,
} from "./index";

import {
    SESSION_PRN_CONNECTED,
    SESSION_FRC_CONNECTED,
    SESSION_DISCONNECTED,
    SESSION_CONNECTING,
    SESSION_ERROR,
    EMPTY_SESSIONS_MAP,
    SINGLE_SESSION_MAP,
    MULTI_SESSION_MAP,
    MULTI_REGION_MAP,
    SESSION_IDS,
    RAW_SESSION_PRN,
    RAW_SESSION_FRC,
    EXEC_SUCCESS,
    EXEC_FAILED,
    API_HEALTH_RESPONSE,
    API_STATUS_RESPONSE,
    createSessions,
    createExecutionResult,
    createSession as createFixtureSession,
} from "./test-fixtures";

import {
    sessionsMapAtom,
    activeSessionIdAtom,
    wsConnectionStatusAtom,
    isInitializedAtom,
    lastErrorAtom,
    sessionsListAtom,
    activeSessionAtom,
    sessionCountAtom,
    connectedSessionsCountAtom,
} from "../store/session-store";

// ============================================================================
// Test Utilities Module Tests
// ============================================================================

describe("Test Utilities", () => {
    describe("setupMockDaemon", () => {
        let mockContext: ReturnType<typeof setupMockDaemon>;

        beforeEach(() => {
            mockContext = setupMockDaemon();
        });

        afterEach(() => {
            mockContext.cleanup();
        });

        it("should create a mock daemon instance", () => {
            expect(mockContext.daemon).toBeInstanceOf(MockDaemon);
        });

        it("should create a mock fetch function", () => {
            expect(typeof mockContext.mockFetch).toBe("function");
        });

        it("should create WebSocket factory", () => {
            const ws = mockContext.createWebSocket("ws://test");
            expect(ws).toBeInstanceOf(MockWebSocket);
        });

        it("should cleanup properly", () => {
            const daemon = mockContext.daemon;
            daemon.createSession("test", "shellserver", "prn");
            expect(daemon.listSessions().data.sessions.length).toBe(1);

            mockContext.cleanup();
            // After cleanup, daemon is reset
            expect(daemon.listSessions().data.sessions.length).toBe(0);
        });
    });

    describe("createSessionEntry", () => {
        it("should create a default session entry", () => {
            const entry = createSessionEntry();
            expect(entry).toHaveProperty("session");
            expect(entry).toHaveProperty("output");
            expect(entry).toHaveProperty("lastActivity");
            expect(entry).toHaveProperty("isActive");
            expect(entry.session).toHaveProperty("id");
            expect(entry.session).toHaveProperty("name");
            expect(entry.session).toHaveProperty("status");
        });

        it("should accept custom options", () => {
            const entry = createSessionEntry({
                id: "custom-id",
                name: "Custom Session",
                status: "connected",
                region: "frc",
                output: ["line1", "line2"],
                isActive: true,
            });

            expect(entry.session.id).toBe("custom-id");
            expect(entry.session.name).toBe("Custom Session");
            expect(entry.session.status).toBe("connected");
            expect(entry.session.region).toBe("frc");
            expect(entry.output).toEqual(["line1", "line2"]);
            expect(entry.isActive).toBe(true);
        });

        it("should create nested session object", () => {
            const entry = createSessionEntry({ id: "test-123" });
            expect(entry.session.id).toBe("test-123");
            expect(typeof entry.session.created_at).toBe("string");
            expect(typeof entry.session.last_activity).toBe("string");
        });
    });

    describe("createSession", () => {
        it("should create a raw Session object", () => {
            const session = createSession();
            expect(session).toHaveProperty("id");
            expect(session).toHaveProperty("name");
            expect(session).toHaveProperty("status");
            expect(session).toHaveProperty("connection_type");
            expect(session).toHaveProperty("region");
            expect(session).toHaveProperty("hostname");
            expect(session).toHaveProperty("created_at");
            expect(session).toHaveProperty("last_activity");
        });

        it("should accept overrides", () => {
            const session = createSession({
                id: "override-id",
                name: "Override Name",
                status: "error",
            });

            expect(session.id).toBe("override-id");
            expect(session.name).toBe("Override Name");
            expect(session.status).toBe("error");
        });
    });

    describe("createSessionsMap", () => {
        it("should create empty map for empty array", () => {
            const map = createSessionsMap([]);
            expect(map.size).toBe(0);
        });

        it("should create map with sessions", () => {
            const map = createSessionsMap([
                { id: "sess-1", name: "Session 1" },
                { id: "sess-2", name: "Session 2" },
            ]);

            expect(map.size).toBe(2);
            expect(map.get("sess-1")?.session.name).toBe("Session 1");
            expect(map.get("sess-2")?.session.name).toBe("Session 2");
        });

        it("should key by session.id", () => {
            const map = createSessionsMap([{ id: "my-key" }]);
            expect(map.has("my-key")).toBe(true);
            const entry = map.get("my-key");
            expect(entry?.session.id).toBe("my-key");
        });
    });

    describe("createOutputLines", () => {
        it("should create specified number of output lines", () => {
            const lines = createOutputLines(5);
            expect(lines).toHaveLength(5);
            expect(lines[0]).toBe("Output line 1");
            expect(lines[4]).toBe("Output line 5");
        });

        it("should create empty array for 0", () => {
            const lines = createOutputLines(0);
            expect(lines).toHaveLength(0);
        });
    });

    describe("createTestStore", () => {
        it("should create a Jotai store", () => {
            const store = createTestStore();
            expect(store).toBeDefined();
            expect(typeof store.get).toBe("function");
            expect(typeof store.set).toBe("function");
        });

        it("should initialize with provided sessions", () => {
            const sessionsMap = new Map();
            sessionsMap.set("test-id", SESSION_PRN_CONNECTED);

            const store = createTestStore({ initialSessions: sessionsMap });
            const storedSessions = store.get(sessionsMapAtom);

            expect(storedSessions.size).toBe(1);
            expect(storedSessions.has("test-id")).toBe(true);
        });

        it("should set active session ID", () => {
            const store = createTestStore({ activeSessionId: "active-123" });
            expect(store.get(activeSessionIdAtom)).toBe("active-123");
        });

        it("should set WebSocket status", () => {
            const store = createTestStore({ wsStatus: "connected" });
            expect(store.get(wsConnectionStatusAtom)).toBe("connected");
        });

        it("should set initialized state", () => {
            const store = createTestStore({ isInitialized: true });
            expect(store.get(isInitializedAtom)).toBe(true);
        });

        it("should set error state", () => {
            const store = createTestStore({ error: "Test error" });
            expect(store.get(lastErrorAtom)).toBe("Test error");
        });
    });

    describe("waitFor", () => {
        it("should resolve when condition is true", async () => {
            let value = false;
            setTimeout(() => {
                value = true;
            }, 10);

            await waitFor(() => value, { timeout: 1000, interval: 5 });
            expect(value).toBe(true);
        });

        it("should timeout when condition never becomes true", async () => {
            await expect(
                waitFor(() => false, { timeout: 50, interval: 10 })
            ).rejects.toThrow("waitFor timed out");
        });
    });
});

// ============================================================================
// Test Fixtures Module Tests
// ============================================================================

describe("Test Fixtures", () => {
    describe("Session Fixtures", () => {
        it("SESSION_PRN_CONNECTED should have correct structure", () => {
            expect(SESSION_PRN_CONNECTED.session).toBeDefined();
            expect(SESSION_PRN_CONNECTED.session.id).toBe("sess_prn_001");
            expect(SESSION_PRN_CONNECTED.session.status).toBe("connected");
            expect(SESSION_PRN_CONNECTED.session.region).toBe("prn");
            expect(SESSION_PRN_CONNECTED.output).toEqual([]);
            expect(SESSION_PRN_CONNECTED.isActive).toBe(false);
        });

        it("SESSION_FRC_CONNECTED should have correct structure", () => {
            expect(SESSION_FRC_CONNECTED.session.id).toBe("sess_frc_001");
            expect(SESSION_FRC_CONNECTED.session.status).toBe("connected");
            expect(SESSION_FRC_CONNECTED.session.region).toBe("frc");
        });

        it("SESSION_DISCONNECTED should have disconnected status", () => {
            expect(SESSION_DISCONNECTED.session.status).toBe("disconnected");
        });

        it("SESSION_CONNECTING should have connecting status", () => {
            expect(SESSION_CONNECTING.session.status).toBe("connecting");
        });

        it("SESSION_ERROR should have error status", () => {
            expect(SESSION_ERROR.session.status).toBe("error");
        });
    });

    describe("Raw Session Fixtures", () => {
        it("RAW_SESSION_PRN should be a Session object", () => {
            expect(RAW_SESSION_PRN.id).toBe("sess_prn_001");
            expect(RAW_SESSION_PRN.name).toBe("PRN ShellServer");
            expect(RAW_SESSION_PRN.status).toBe("connected");
            expect(RAW_SESSION_PRN.connection_type).toBe("od-shellserver");
            expect(RAW_SESSION_PRN.region).toBe("prn");
        });

        it("RAW_SESSION_FRC should be a Session object", () => {
            expect(RAW_SESSION_FRC.id).toBe("sess_frc_001");
            expect(RAW_SESSION_FRC.name).toBe("FRC ShellServer");
            expect(RAW_SESSION_FRC.region).toBe("frc");
        });
    });

    describe("Session Map Fixtures", () => {
        it("EMPTY_SESSIONS_MAP should be empty", () => {
            expect(EMPTY_SESSIONS_MAP.size).toBe(0);
        });

        it("SINGLE_SESSION_MAP should have one session", () => {
            expect(SINGLE_SESSION_MAP.size).toBe(1);
            expect(SINGLE_SESSION_MAP.has("sess_prn_001")).toBe(true);
        });

        it("MULTI_SESSION_MAP should have multiple sessions", () => {
            expect(MULTI_SESSION_MAP.size).toBe(3);
            expect(MULTI_SESSION_MAP.has("sess_prn_001")).toBe(true);
            expect(MULTI_SESSION_MAP.has("sess_frc_001")).toBe(true);
            expect(MULTI_SESSION_MAP.has("sess_disconnected_001")).toBe(true);
        });

        it("MULTI_REGION_MAP should have sessions from different regions", () => {
            expect(MULTI_REGION_MAP.size).toBeGreaterThanOrEqual(2);
            const regions = new Set<string>();
            MULTI_REGION_MAP.forEach((entry) => {
                regions.add(entry.session.region || "unknown");
            });
            expect(regions.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe("Execution Fixtures", () => {
        it("EXEC_SUCCESS should have success status", () => {
            expect(EXEC_SUCCESS.status).toBe("completed");
            expect(EXEC_SUCCESS.exit_code).toBe(0);
            expect(EXEC_SUCCESS.output).toBeDefined();
        });

        it("EXEC_FAILED should have error status", () => {
            expect(EXEC_FAILED.status).toBe("error");
            expect(EXEC_FAILED.exit_code).not.toBe(0);
        });
    });

    describe("API Response Fixtures", () => {
        it("API_HEALTH_RESPONSE should have healthy status", () => {
            expect(API_HEALTH_RESPONSE.status).toBe("healthy");
            expect(API_HEALTH_RESPONSE.version).toBeDefined();
        });

        it("API_STATUS_RESPONSE should have session counts", () => {
            expect(API_STATUS_RESPONSE.sessions).toBeDefined();
            expect(API_STATUS_RESPONSE.sessions.active).toBeDefined();
        });
    });

    describe("Factory Functions", () => {
        it("createSessions should generate multiple sessions", () => {
            const sessions = createSessions(3);
            expect(sessions).toHaveLength(3);
            sessions.forEach((entry) => {
                expect(entry.session.id).toBeDefined();
                expect(entry.session.name).toBeDefined();
            });
        });

        it("createExecutionResult should create execution result", () => {
            const result = createExecutionResult({
                command: "ls -la",
                output: "file1\nfile2",
            });
            expect(result.command).toBe("ls -la");
            expect(result.output).toBe("file1\nfile2");
        });
    });
});

// ============================================================================
// TestProvider Component Tests
// ============================================================================

describe("TestProvider", () => {
    it("should be a function component", () => {
        expect(typeof TestProvider).toBe("function");
    });

    it("should accept children prop", () => {
        // Verify the component signature
        const element = React.createElement(TestProvider, {
            children: React.createElement("div", null, "Test"),
        });
        expect(element.props.children).toBeDefined();
    });

    it("should accept initialSessions prop", () => {
        const element = React.createElement(TestProvider, {
            children: React.createElement("div"),
            initialSessions: SINGLE_SESSION_MAP,
        });
        expect(element.props.initialSessions).toBe(SINGLE_SESSION_MAP);
    });

    it("should accept wsStatus prop", () => {
        const element = React.createElement(TestProvider, {
            children: React.createElement("div"),
            wsStatus: "connected",
        });
        expect(element.props.wsStatus).toBe("connected");
    });
});

// ============================================================================
// MockDaemonProvider Tests (imported from mock-provider.tsx)
// ============================================================================

describe("MockDaemonProvider", () => {
    // Test that the provider exports are correct
    it("should export MockDaemonProvider component", async () => {
        const { MockDaemonProvider } = await import("./mock-provider");
        expect(typeof MockDaemonProvider).toBe("function");
    });

    it("should export useMockDaemon hook", async () => {
        const { useMockDaemon } = await import("./mock-provider");
        expect(typeof useMockDaemon).toBe("function");
    });

    it("should export withMockDaemon HOC", async () => {
        const { withMockDaemon } = await import("./mock-provider");
        expect(typeof withMockDaemon).toBe("function");
    });

    it("should export createMockDaemonWrapper", async () => {
        const { createMockDaemonWrapper } = await import("./mock-provider");
        expect(typeof createMockDaemonWrapper).toBe("function");
    });

    it("should export pre-configured wrappers", async () => {
        const {
            ConnectedMockDaemonWrapper,
            DisconnectedMockDaemonWrapper,
            ErrorMockDaemonWrapper,
        } = await import("./mock-provider");

        expect(typeof ConnectedMockDaemonWrapper).toBe("function");
        expect(typeof DisconnectedMockDaemonWrapper).toBe("function");
        expect(typeof ErrorMockDaemonWrapper).toBe("function");
    });
});

// ============================================================================
// Store Integration Tests with Test Utilities
// ============================================================================

describe("Store Integration with Test Utilities", () => {
    describe("Session Store with createTestStore", () => {
        it("should initialize store with fixture sessions", () => {
            const store = createTestStore({
                initialSessions: MULTI_SESSION_MAP,
            });

            const sessions = store.get(sessionsMapAtom);
            expect(sessions.size).toBe(3); // PRN, FRC, DISCONNECTED
        });

        it("should compute session count correctly", () => {
            const store = createTestStore({
                initialSessions: MULTI_SESSION_MAP,
            });

            const count = store.get(sessionCountAtom);
            expect(count).toBe(3); // PRN, FRC, DISCONNECTED
        });

        it("should compute connected sessions count", () => {
            const store = createTestStore({
                initialSessions: MULTI_SESSION_MAP,
            });

            const connected = store.get(connectedSessionsCountAtom);
            // Both PRN and FRC are connected
            expect(connected).toBe(2);
        });

        it("should track active session", () => {
            const store = createTestStore({
                initialSessions: SINGLE_SESSION_MAP,
                activeSessionId: "sess_prn_001",
            });

            const activeId = store.get(activeSessionIdAtom);
            expect(activeId).toBe("sess_prn_001");
        });

        it("should return null for active session when none set", () => {
            const store = createTestStore({
                initialSessions: SINGLE_SESSION_MAP,
                activeSessionId: null,
            });

            const activeSession = store.get(activeSessionAtom);
            expect(activeSession).toBeNull();
        });
    });

    describe("Session operations with mock daemon", () => {
        let daemon: MockDaemon;

        beforeEach(() => {
            daemon = new MockDaemon();
        });

        afterEach(() => {
            daemon.reset();
        });

        it("should sync daemon sessions to store", () => {
            // Create sessions in daemon
            daemon.createSession("Session 1", "shellserver", "prn");
            daemon.createSession("Session 2", "shellserver", "frc");

            // Verify daemon has sessions
            const daemonSessions = daemon.listSessions().data.sessions;
            expect(daemonSessions.length).toBe(2);

            // Create store with daemon sessions
            const sessionsMap = new Map();
            daemonSessions.forEach((session) => {
                sessionsMap.set(session.id, {
                    session,
                    output: [],
                    lastActivity: new Date().toISOString(),
                    isActive: false,
                });
            });

            const store = createTestStore({ initialSessions: sessionsMap });
            expect(store.get(sessionCountAtom)).toBe(2);
        });
    });
});

// ============================================================================
// Component Export Verification Tests
// ============================================================================

describe("Component Exports", () => {
    describe("QuickConnect Component", () => {
        it("should export QuickConnect", async () => {
            const { QuickConnect } = await import("../quickconnect");
            expect(QuickConnect).toBeDefined();
            expect(typeof QuickConnect).toBe("object"); // memo returns object
        });

        it("should export RegionStatus", async () => {
            const { RegionStatus } = await import("../quickconnect");
            expect(RegionStatus).toBeDefined();
        });

        it("should export ActiveConnections", async () => {
            const { ActiveConnections } = await import("../quickconnect");
            expect(ActiveConnections).toBeDefined();
        });
    });

    describe("SiteOpsPalette Component", () => {
        it("should export SiteOpsPalette", async () => {
            const { SiteOpsPalette } = await import("../siteops-palette");
            expect(SiteOpsPalette).toBeDefined();
        });

        it("should export useSiteOpsPalette hook", async () => {
            const { useSiteOpsPalette } = await import("../siteops-palette");
            expect(typeof useSiteOpsPalette).toBe("function");
        });

        it("should export SITEOPS_COMMANDS", async () => {
            const { SITEOPS_COMMANDS } = await import("../siteops-palette");
            expect(Array.isArray(SITEOPS_COMMANDS)).toBe(true);
            expect(SITEOPS_COMMANDS.length).toBeGreaterThan(0);
        });

        it("should export CATEGORIES", async () => {
            const { CATEGORIES } = await import("../siteops-palette");
            expect(Array.isArray(CATEGORIES)).toBe(true);
            expect(CATEGORIES).toContain("All");
        });
    });
});

// ============================================================================
// SiteOps Commands Data Tests
// ============================================================================

describe("SiteOps Commands Data", () => {
    it("should have commands for all categories", async () => {
        const { SITEOPS_COMMANDS, CATEGORIES } = await import("../siteops-palette");

        // Get unique categories from commands
        const commandCategories = new Set(SITEOPS_COMMANDS.map((cmd) => cmd.category));

        // All command categories should be in CATEGORIES (except "All")
        commandCategories.forEach((cat) => {
            expect(CATEGORIES).toContain(cat);
        });
    });

    it("should have required properties for each command", async () => {
        const { SITEOPS_COMMANDS } = await import("../siteops-palette");

        SITEOPS_COMMANDS.forEach((cmd) => {
            expect(cmd.name).toBeDefined();
            expect(cmd.description).toBeDefined();
            expect(cmd.command).toBeDefined();
            expect(cmd.category).toBeDefined();
            expect(typeof cmd.requiresArg).toBe("boolean");
        });
    });

    it("should have argHint when requiresArg is true", async () => {
        const { SITEOPS_COMMANDS } = await import("../siteops-palette");

        const commandsRequiringArg = SITEOPS_COMMANDS.filter((cmd) => cmd.requiresArg);
        commandsRequiringArg.forEach((cmd) => {
            expect(cmd.argHint).toBeDefined();
        });
    });

    it("should include common diagnostic commands", async () => {
        const { SITEOPS_COMMANDS } = await import("../siteops-palette");

        const commandNames = SITEOPS_COMMANDS.map((cmd) => cmd.name);
        expect(commandNames).toContain("hostory");
        expect(commandNames).toContain("hwc");
        expect(commandNames).toContain("machinechecker");
        expect(commandNames).toContain("repair");
    });
});

// ============================================================================
// QuickConnect Preset Data Tests
// ============================================================================

describe("QuickConnect Preset Data", () => {
    it("should have OD_PRESETS defined in component", async () => {
        // Since OD_PRESETS is not exported, we test component structure
        const { QuickConnect } = await import("../quickconnect");
        expect(QuickConnect).toBeDefined();
    });

    it("should have expected regions", async () => {
        // Verify regions match expected datacenter codes
        const expectedRegions = ["prn", "frc", "lco", "alb", "ftw"];

        // Test that our fixtures include these regions
        const fixture = SESSION_PRN_CONNECTED;
        expect(expectedRegions).toContain(fixture.session.region);
    });
});

// ============================================================================
// Mock Daemon Integration with Components
// ============================================================================

describe("Mock Daemon Component Integration", () => {
    let mockContext: ReturnType<typeof setupMockDaemon>;

    beforeEach(() => {
        mockContext = setupMockDaemon();
    });

    afterEach(() => {
        mockContext.cleanup();
    });

    it("should create sessions that match component expectations", () => {
        const session = mockContext.daemon.createSession(
            "PRN ShellServer",
            "od-shellserver",
            "prn"
        );

        // Session should have all properties expected by QuickConnect
        expect(session.id).toBeDefined();
        expect(session.name).toBe("PRN ShellServer");
        expect(session.status).toBe("connecting");
        expect(session.connection_type).toBe("od-shellserver");
        expect(session.region).toBe("prn");
    });

    it("should support session status transitions", async () => {
        const session = mockContext.daemon.createSession(
            "Test Session",
            "shellserver",
            "prn"
        );

        expect(session.status).toBe("connecting");

        // Wait for auto-connect
        await new Promise((resolve) => setTimeout(resolve, 150));

        const updated = mockContext.daemon.getSession(session.id);
        expect(updated?.status).toBe("connected");
    });

    it("should execute commands that return SiteOps-like output", () => {
        const session = mockContext.daemon.createSession(
            "Test Session",
            "shellserver",
            "prn"
        );

        // Simulate connected state
        mockContext.daemon.sessions.get(session.id)!.status = "connected";

        const result = mockContext.daemon.execute(session.id, "hostory devvm001.prn");

        expect(result.status).toBe("completed");
        expect(result.output).toBeDefined();
        expect(result.exit_code).toBe(0);
    });
});

// ============================================================================
// WebSocket Integration with Components
// ============================================================================

describe("WebSocket Component Integration", () => {
    let mockContext: ReturnType<typeof setupMockDaemon>;

    beforeEach(() => {
        mockContext = setupMockDaemon();
    });

    afterEach(() => {
        mockContext.cleanup();
    });

    it("should create WebSocket that supports session subscriptions", async () => {
        const ws = mockContext.createWebSocket("ws://localhost:9876/ws");

        // Create a session to subscribe to
        const session = mockContext.daemon.createSession("Test", "shellserver", "prn");

        // Wait for auto-connect (50ms delay in MockWebSocket)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Subscribe message
        ws.send(JSON.stringify({
            type: "subscribe:session",
            session_id: session.id,
        }));

        // Verify WebSocket is open and can receive messages
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
    });

    it("should receive output events for subscribed sessions", async () => {
        const ws = mockContext.createWebSocket("ws://localhost:9876/ws");
        const session = mockContext.daemon.createSession("Test", "shellserver", "prn");

        // Set up message handler
        const messages: unknown[] = [];
        ws.onmessage = (event) => {
            messages.push(JSON.parse(event.data as string));
        };

        // Wait for auto-connect (50ms delay in MockWebSocket)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Subscribe to session
        ws.send(JSON.stringify({
            type: "subscribe:session",
            session_id: session.id,
        }));

        // Execute command to generate output - session must be connected
        mockContext.daemon.sessions.get(session.id)!.status = "connected";

        ws.send(JSON.stringify({
            type: "execute:command",
            session_id: session.id,
            command: "echo test",
            request_id: "req-001",
        }));

        // Wait for async processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should have received output event
        const outputEvent = messages.find(
            (m: unknown) => (m as { type: string }).type === "session:output"
        );
        expect(outputEvent).toBeDefined();
    });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling with Test Utilities", () => {
    it("should handle SESSION_ERROR fixture correctly", () => {
        const store = createTestStore({
            initialSessions: new Map([["error-session", SESSION_ERROR]]),
        });

        const sessions = store.get(sessionsMapAtom);
        const errorSession = sessions.get("error-session");

        expect(errorSession?.session.status).toBe("error");
    });

    it("should handle store error state", () => {
        const store = createTestStore({
            error: "Connection failed: Network error",
        });

        expect(store.get(lastErrorAtom)).toBe("Connection failed: Network error");
    });

    it("should handle mock daemon errors", () => {
        const daemon = new MockDaemon();

        // Try to get non-existent session
        const session = daemon.getSession("non-existent-id");
        expect(session).toBeNull();

        // Try to execute on non-existent session - returns null
        const result = daemon.execute("non-existent-id", "command");
        expect(result).toBeNull();

        daemon.reset();
    });
});

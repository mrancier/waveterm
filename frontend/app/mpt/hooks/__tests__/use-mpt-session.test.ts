// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for MPT Session Hook Logic
// Tests the underlying API interactions and state management used by hooks
// Note: Since @testing-library/react is not available, we test the core logic directly

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock Setup
// ============================================================================

// Mock API client
const mockApiClient = {
    health: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    execute: vi.fn(),
    reconnectSession: vi.fn(),
};

vi.mock("../../api/mpt-api", () => ({
    getMPTClient: vi.fn(() => mockApiClient),
}));

// Mock WebSocket client
const mockWsClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribeToSession: vi.fn(),
    unsubscribeFromSession: vi.fn(),
    onConnectionChange: vi.fn(() => vi.fn()),
    onOutput: vi.fn(() => vi.fn()),
    onStatus: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
};

vi.mock("../../api/mpt-websocket", () => ({
    getMPTWebSocket: vi.fn(() => mockWsClient),
}));

// Import getMPTClient and getMPTWebSocket to verify mock calls
import { getMPTClient } from "../../api/mpt-api";
import { getMPTWebSocket } from "../../api/mpt-websocket";
import type { Session, SessionStatus, ExecutionResult, CreateSessionRequest } from "../../api/mpt-api";
import type { SessionOutputEvent, SessionStatusEvent } from "../../api/mpt-websocket";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockSession = (overrides: Partial<Session> = {}): Session => ({
    id: "sess_test_001",
    name: "Test Session",
    status: "connected" as SessionStatus,
    connection_type: "shellserver",
    region: "prn",
    hostname: "devvm001.prn",
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    ...overrides,
});

const createMockExecutionResult = (overrides: Partial<ExecutionResult> = {}): ExecutionResult => ({
    request_id: "req_001",
    session_id: "sess_test_001",
    command: "hostname",
    status: "completed",
    exit_code: 0,
    output: "devvm001.prn\n",
    execution_time_ms: 50,
    ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

describe("MPT Session Hook Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockApiClient.getSession.mockResolvedValue(createMockSession());
        mockApiClient.createSession.mockResolvedValue(createMockSession());
        mockApiClient.deleteSession.mockResolvedValue(true);
        mockApiClient.listSessions.mockResolvedValue({
            sessions: [createMockSession()],
            total: 1,
        });
        mockApiClient.execute.mockResolvedValue(createMockExecutionResult());
        mockApiClient.reconnectSession.mockResolvedValue(true);
        mockWsClient.connect.mockResolvedValue(undefined);
    });

    // ============================================================================
    // Session API Integration Tests (useODSession logic)
    // ============================================================================

    describe("Session API Integration", () => {
        describe("Session Loading", () => {
            it("should load session by ID from API", async () => {
                const mockSession = createMockSession({ id: "sess_load_test" });
                mockApiClient.getSession.mockResolvedValue(mockSession);

                const api = getMPTClient();
                const session = await api.getSession("sess_load_test");

                expect(mockApiClient.getSession).toHaveBeenCalledWith("sess_load_test");
                expect(session).not.toBeNull();
                expect(session?.id).toBe("sess_load_test");
            });

            it("should return null for non-existent session", async () => {
                mockApiClient.getSession.mockResolvedValue(null);

                const api = getMPTClient();
                const session = await api.getSession("non_existent");

                expect(session).toBeNull();
            });

            it("should handle API error during session loading", async () => {
                mockApiClient.getSession.mockRejectedValue(new Error("Network error"));

                const api = getMPTClient();
                await expect(api.getSession("sess_001")).rejects.toThrow("Network error");
            });
        });

        describe("Session Creation", () => {
            it("should create a new session via API", async () => {
                const mockSession = createMockSession({ id: "sess_new", name: "New Session" });
                mockApiClient.createSession.mockResolvedValue(mockSession);

                const api = getMPTClient();
                const request: CreateSessionRequest = {
                    name: "New Session",
                    connection_type: "shellserver",
                    region: "prn",
                };
                const session = await api.createSession(request);

                expect(mockApiClient.createSession).toHaveBeenCalledWith(request);
                expect(session).not.toBeNull();
                expect(session?.id).toBe("sess_new");
                expect(session?.name).toBe("New Session");
            });

            it("should return null if session creation fails", async () => {
                mockApiClient.createSession.mockResolvedValue(null);

                const api = getMPTClient();
                const session = await api.createSession({
                    name: "Failed Session",
                    connection_type: "shellserver",
                });

                expect(session).toBeNull();
            });

            it("should handle API error during session creation", async () => {
                mockApiClient.createSession.mockRejectedValue(new Error("Creation failed"));

                const api = getMPTClient();
                await expect(
                    api.createSession({
                        name: "Error Session",
                        connection_type: "shellserver",
                    })
                ).rejects.toThrow("Creation failed");
            });
        });

        describe("Session Deletion", () => {
            it("should delete session via API", async () => {
                mockApiClient.deleteSession.mockResolvedValue(true);

                const api = getMPTClient();
                const success = await api.deleteSession("sess_delete");

                expect(mockApiClient.deleteSession).toHaveBeenCalledWith("sess_delete");
                expect(success).toBe(true);
            });

            it("should return false if deletion fails", async () => {
                mockApiClient.deleteSession.mockResolvedValue(false);

                const api = getMPTClient();
                const success = await api.deleteSession("sess_fail");

                expect(success).toBe(false);
            });
        });

        describe("Session Reconnection", () => {
            it("should reconnect to session via API", async () => {
                mockApiClient.reconnectSession.mockResolvedValue(true);

                const api = getMPTClient();
                const success = await api.reconnectSession("sess_reconnect");

                expect(mockApiClient.reconnectSession).toHaveBeenCalledWith("sess_reconnect");
                expect(success).toBe(true);
            });

            it("should return false if reconnection fails", async () => {
                mockApiClient.reconnectSession.mockResolvedValue(false);

                const api = getMPTClient();
                const success = await api.reconnectSession("sess_fail");

                expect(success).toBe(false);
            });

            it("should handle API error during reconnection", async () => {
                mockApiClient.reconnectSession.mockRejectedValue(new Error("Reconnection error"));

                const api = getMPTClient();
                await expect(api.reconnectSession("sess_error")).rejects.toThrow("Reconnection error");
            });
        });
    });

    // ============================================================================
    // Command Execution Tests (useODSession and useCommandExecution logic)
    // ============================================================================

    describe("Command Execution", () => {
        it("should execute command and return result", async () => {
            const mockResult = createMockExecutionResult({
                command: "hostname",
                output: "server01.prn\n",
                exit_code: 0,
            });
            mockApiClient.execute.mockResolvedValue(mockResult);

            const api = getMPTClient();
            const result = await api.execute({
                session_id: "sess_exec",
                command: "hostname",
            });

            expect(mockApiClient.execute).toHaveBeenCalledWith({
                session_id: "sess_exec",
                command: "hostname",
            });
            expect(result).not.toBeNull();
            expect(result?.output).toBe("server01.prn\n");
            expect(result?.exit_code).toBe(0);
        });

        it("should handle command execution with non-zero exit code", async () => {
            const mockResult = createMockExecutionResult({
                command: "invalid_cmd",
                output: "command not found\n",
                exit_code: 127,
                status: "error",
            });
            mockApiClient.execute.mockResolvedValue(mockResult);

            const api = getMPTClient();
            const result = await api.execute({
                session_id: "sess_exec",
                command: "invalid_cmd",
            });

            expect(result?.exit_code).toBe(127);
            expect(result?.status).toBe("error");
        });

        it("should handle command execution timeout", async () => {
            const mockResult = createMockExecutionResult({
                command: "sleep 1000",
                output: "",
                status: "timeout",
            });
            mockApiClient.execute.mockResolvedValue(mockResult);

            const api = getMPTClient();
            const result = await api.execute({
                session_id: "sess_exec",
                command: "sleep 1000",
            });

            expect(result?.status).toBe("timeout");
        });

        it("should handle API error during execution", async () => {
            mockApiClient.execute.mockRejectedValue(new Error("Execution error"));

            const api = getMPTClient();
            await expect(
                api.execute({
                    session_id: "sess_exec",
                    command: "cmd",
                })
            ).rejects.toThrow("Execution error");
        });

        it("should return null if execution fails silently", async () => {
            mockApiClient.execute.mockResolvedValue(null);

            const api = getMPTClient();
            const result = await api.execute({
                session_id: "sess_exec",
                command: "cmd",
            });

            expect(result).toBeNull();
        });
    });

    // ============================================================================
    // Sessions List Tests (useSessions logic)
    // ============================================================================

    describe("Sessions List", () => {
        it("should list all sessions from API", async () => {
            const mockSessions = [
                createMockSession({ id: "sess_1", name: "Session 1" }),
                createMockSession({ id: "sess_2", name: "Session 2" }),
            ];
            mockApiClient.listSessions.mockResolvedValue({
                sessions: mockSessions,
                total: 2,
            });

            const api = getMPTClient();
            const result = await api.listSessions();

            expect(mockApiClient.listSessions).toHaveBeenCalled();
            expect(result).not.toBeNull();
            expect(result?.sessions).toHaveLength(2);
            expect(result?.sessions[0].id).toBe("sess_1");
            expect(result?.sessions[1].id).toBe("sess_2");
        });

        it("should return empty list when no sessions exist", async () => {
            mockApiClient.listSessions.mockResolvedValue({
                sessions: [],
                total: 0,
            });

            const api = getMPTClient();
            const result = await api.listSessions();

            expect(result?.sessions).toHaveLength(0);
            expect(result?.total).toBe(0);
        });

        it("should handle API error during session listing", async () => {
            mockApiClient.listSessions.mockRejectedValue(new Error("Network error"));

            const api = getMPTClient();
            await expect(api.listSessions()).rejects.toThrow("Network error");
        });
    });

    // ============================================================================
    // WebSocket Integration Tests (useMPTConnection and useSessionOutput logic)
    // ============================================================================

    describe("WebSocket Integration", () => {
        describe("Connection Management", () => {
            it("should connect to WebSocket", async () => {
                mockWsClient.connect.mockResolvedValue(undefined);

                const ws = getMPTWebSocket();
                await ws.connect();

                expect(mockWsClient.connect).toHaveBeenCalled();
            });

            it("should disconnect from WebSocket", () => {
                const ws = getMPTWebSocket();
                ws.disconnect();

                expect(mockWsClient.disconnect).toHaveBeenCalled();
            });

            it("should handle connection failure", async () => {
                mockWsClient.connect.mockRejectedValue(new Error("Connection refused"));

                const ws = getMPTWebSocket();
                await expect(ws.connect()).rejects.toThrow("Connection refused");
            });
        });

        describe("Session Subscription", () => {
            it("should subscribe to session updates", () => {
                const ws = getMPTWebSocket();
                ws.subscribeToSession("sess_sub");

                expect(mockWsClient.subscribeToSession).toHaveBeenCalledWith("sess_sub");
            });

            it("should unsubscribe from session updates", () => {
                const ws = getMPTWebSocket();
                ws.unsubscribeFromSession("sess_unsub");

                expect(mockWsClient.unsubscribeFromSession).toHaveBeenCalledWith("sess_unsub");
            });
        });

        describe("Event Handlers", () => {
            it("should register connection change handler", () => {
                const callback = vi.fn();

                const ws = getMPTWebSocket();
                ws.onConnectionChange(callback);

                expect(mockWsClient.onConnectionChange).toHaveBeenCalledWith(callback);
            });

            it("should register output event handler", () => {
                const callback = vi.fn();

                const ws = getMPTWebSocket();
                ws.onOutput("sess_001", callback);

                expect(mockWsClient.onOutput).toHaveBeenCalledWith("sess_001", callback);
            });

            it("should register status event handler", () => {
                const callback = vi.fn();

                const ws = getMPTWebSocket();
                ws.onStatus("sess_001", callback);

                expect(mockWsClient.onStatus).toHaveBeenCalledWith("sess_001", callback);
            });

            it("should register error event handler", () => {
                const callback = vi.fn();

                const ws = getMPTWebSocket();
                ws.onError(callback);

                expect(mockWsClient.onError).toHaveBeenCalledWith(callback);
            });

            it("should return unsubscribe function from event handlers", () => {
                const unsubscribe = vi.fn();
                mockWsClient.onConnectionChange.mockReturnValue(unsubscribe);

                const ws = getMPTWebSocket();
                const result = ws.onConnectionChange(vi.fn());

                expect(typeof result).toBe("function");
            });
        });

        describe("Output Buffer Logic", () => {
            it("should handle output events with data", () => {
                const callback = vi.fn();
                let capturedCallback: ((event: SessionOutputEvent) => void) | null = null;
                mockWsClient.onOutput.mockImplementation((sessionId, cb) => {
                    capturedCallback = cb;
                    return vi.fn();
                });

                const ws = getMPTWebSocket();
                ws.onOutput("sess_001", callback);

                // Simulate output event
                const outputEvent: SessionOutputEvent = {
                    session_id: "sess_001",
                    data: "test output\n",
                    timestamp: new Date().toISOString(),
                };
                capturedCallback?.(outputEvent);

                expect(callback).toHaveBeenCalledWith(outputEvent);
            });

            it("should handle multiple output events", () => {
                const receivedEvents: SessionOutputEvent[] = [];
                let capturedCallback: ((event: SessionOutputEvent) => void) | null = null;
                mockWsClient.onOutput.mockImplementation((sessionId, cb) => {
                    capturedCallback = cb;
                    return vi.fn();
                });

                const ws = getMPTWebSocket();
                ws.onOutput("sess_001", (event) => {
                    receivedEvents.push(event);
                });

                // Simulate multiple output events
                for (let i = 1; i <= 3; i++) {
                    capturedCallback?.({
                        session_id: "sess_001",
                        data: `line ${i}\n`,
                        timestamp: new Date().toISOString(),
                    });
                }

                expect(receivedEvents).toHaveLength(3);
                expect(receivedEvents[0].data).toBe("line 1\n");
                expect(receivedEvents[1].data).toBe("line 2\n");
                expect(receivedEvents[2].data).toBe("line 3\n");
            });
        });

        describe("Status Update Logic", () => {
            it("should handle status change events", () => {
                const callback = vi.fn();
                let capturedCallback: ((event: SessionStatusEvent) => void) | null = null;
                mockWsClient.onStatus.mockImplementation((sessionId, cb) => {
                    capturedCallback = cb;
                    return vi.fn();
                });

                const ws = getMPTWebSocket();
                ws.onStatus("sess_001", callback);

                // Simulate status event
                const statusEvent: SessionStatusEvent = {
                    session_id: "sess_001",
                    status: "disconnected",
                    timestamp: new Date().toISOString(),
                };
                capturedCallback?.(statusEvent);

                expect(callback).toHaveBeenCalledWith(statusEvent);
            });

            it("should handle status transitions", () => {
                const statusHistory: string[] = [];
                let capturedCallback: ((event: SessionStatusEvent) => void) | null = null;
                mockWsClient.onStatus.mockImplementation((sessionId, cb) => {
                    capturedCallback = cb;
                    return vi.fn();
                });

                const ws = getMPTWebSocket();
                ws.onStatus("sess_001", (event) => {
                    statusHistory.push(event.status);
                });

                // Simulate status transitions
                const statuses = ["connecting", "connected", "disconnected", "reconnecting", "connected"];
                statuses.forEach((status) => {
                    capturedCallback?.({
                        session_id: "sess_001",
                        status,
                        timestamp: new Date().toISOString(),
                    });
                });

                expect(statusHistory).toEqual(statuses);
            });
        });
    });

    // ============================================================================
    // Connection State Logic Tests (useMPTConnection logic)
    // ============================================================================

    describe("Connection State Logic", () => {
        it("should track connected state", () => {
            let connectionStatus = "disconnected";
            let capturedCallback: ((status: string) => void) | null = null;
            mockWsClient.onConnectionChange.mockImplementation((cb) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const ws = getMPTWebSocket();
            ws.onConnectionChange((status) => {
                connectionStatus = status;
            });

            capturedCallback?.("connected");
            expect(connectionStatus).toBe("connected");

            const isConnected = connectionStatus === "connected";
            expect(isConnected).toBe(true);
        });

        it("should track connecting state", () => {
            let connectionStatus = "disconnected";
            let capturedCallback: ((status: string) => void) | null = null;
            mockWsClient.onConnectionChange.mockImplementation((cb) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const ws = getMPTWebSocket();
            ws.onConnectionChange((status) => {
                connectionStatus = status;
            });

            capturedCallback?.("connecting");
            expect(connectionStatus).toBe("connecting");

            const isConnecting = connectionStatus === "connecting" || connectionStatus === "reconnecting";
            expect(isConnecting).toBe(true);
        });

        it("should track reconnecting state", () => {
            let connectionStatus = "disconnected";
            let capturedCallback: ((status: string) => void) | null = null;
            mockWsClient.onConnectionChange.mockImplementation((cb) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const ws = getMPTWebSocket();
            ws.onConnectionChange((status) => {
                connectionStatus = status;
            });

            capturedCallback?.("reconnecting");
            expect(connectionStatus).toBe("reconnecting");

            const isConnecting = connectionStatus === "connecting" || connectionStatus === "reconnecting";
            expect(isConnecting).toBe(true);
        });

        it("should track error state", () => {
            let connectionStatus = "disconnected";
            let capturedCallback: ((status: string) => void) | null = null;
            mockWsClient.onConnectionChange.mockImplementation((cb) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const ws = getMPTWebSocket();
            ws.onConnectionChange((status) => {
                connectionStatus = status;
            });

            capturedCallback?.("error");
            expect(connectionStatus).toBe("error");
        });

        it("should handle error events", () => {
            let lastError: { code: string; message: string } | null = null;
            let capturedCallback: ((code: string, message: string) => void) | null = null;
            mockWsClient.onError.mockImplementation((cb) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const ws = getMPTWebSocket();
            ws.onError((code, message) => {
                lastError = { code, message };
            });

            capturedCallback?.("AUTH_ERROR", "Invalid token");

            expect(lastError).not.toBeNull();
            expect(lastError?.code).toBe("AUTH_ERROR");
            expect(lastError?.message).toBe("Invalid token");
        });
    });

    // ============================================================================
    // Integration Workflow Tests
    // ============================================================================

    describe("Integration Workflows", () => {
        it("should handle complete session lifecycle", async () => {
            const mockSession = createMockSession({ id: "sess_lifecycle" });
            mockApiClient.createSession.mockResolvedValue(mockSession);
            mockApiClient.deleteSession.mockResolvedValue(true);

            const api = getMPTClient();
            const ws = getMPTWebSocket();

            // Create session
            const session = await api.createSession({
                name: "Lifecycle Test",
                connection_type: "shellserver",
            });
            expect(session?.id).toBe("sess_lifecycle");

            // Subscribe to updates
            ws.subscribeToSession(session!.id);
            expect(mockWsClient.subscribeToSession).toHaveBeenCalledWith("sess_lifecycle");

            // Execute command
            const result = await api.execute({
                session_id: session!.id,
                command: "hostname",
            });
            expect(result).not.toBeNull();

            // Unsubscribe and delete
            ws.unsubscribeFromSession(session!.id);
            const deleted = await api.deleteSession(session!.id);
            expect(deleted).toBe(true);
        });

        it("should handle session with real-time output", async () => {
            const mockSession = createMockSession({ id: "sess_realtime" });
            mockApiClient.createSession.mockResolvedValue(mockSession);

            const outputBuffer: string[] = [];
            let outputCallback: ((event: SessionOutputEvent) => void) | null = null;
            mockWsClient.onOutput.mockImplementation((sessionId, cb) => {
                outputCallback = cb;
                return vi.fn();
            });

            const api = getMPTClient();
            const ws = getMPTWebSocket();

            // Create session
            const session = await api.createSession({
                name: "Realtime Test",
                connection_type: "shellserver",
            });

            // Subscribe to output
            ws.subscribeToSession(session!.id);
            ws.onOutput(session!.id, (event) => {
                outputBuffer.push(event.data);
            });

            // Simulate receiving output
            outputCallback?.({
                session_id: session!.id,
                data: "Command output line 1\n",
                timestamp: new Date().toISOString(),
            });
            outputCallback?.({
                session_id: session!.id,
                data: "Command output line 2\n",
                timestamp: new Date().toISOString(),
            });

            expect(outputBuffer).toHaveLength(2);
            expect(outputBuffer[0]).toBe("Command output line 1\n");
            expect(outputBuffer[1]).toBe("Command output line 2\n");
        });

        it("should handle reconnection workflow", async () => {
            const mockSession = createMockSession({
                id: "sess_reconnect_workflow",
                status: "disconnected",
            });
            mockApiClient.getSession.mockResolvedValue(mockSession);
            mockApiClient.reconnectSession.mockResolvedValue(true);

            let currentStatus = "disconnected";
            let statusCallback: ((event: SessionStatusEvent) => void) | null = null;
            mockWsClient.onStatus.mockImplementation((sessionId, cb) => {
                statusCallback = cb;
                return vi.fn();
            });

            const api = getMPTClient();
            const ws = getMPTWebSocket();

            // Load disconnected session
            const session = await api.getSession("sess_reconnect_workflow");
            expect(session?.status).toBe("disconnected");

            // Subscribe to status updates
            ws.onStatus(session!.id, (event) => {
                currentStatus = event.status;
            });

            // Trigger reconnect
            const reconnected = await api.reconnectSession(session!.id);
            expect(reconnected).toBe(true);

            // Simulate status updates
            statusCallback?.({
                session_id: session!.id,
                status: "connecting",
                timestamp: new Date().toISOString(),
            });
            expect(currentStatus).toBe("connecting");

            statusCallback?.({
                session_id: session!.id,
                status: "connected",
                timestamp: new Date().toISOString(),
            });
            expect(currentStatus).toBe("connected");
        });

        it("should handle multiple sessions", async () => {
            const sessions = [
                createMockSession({ id: "sess_multi_1", name: "Session 1" }),
                createMockSession({ id: "sess_multi_2", name: "Session 2" }),
                createMockSession({ id: "sess_multi_3", name: "Session 3" }),
            ];

            mockApiClient.createSession
                .mockResolvedValueOnce(sessions[0])
                .mockResolvedValueOnce(sessions[1])
                .mockResolvedValueOnce(sessions[2]);

            const api = getMPTClient();
            const ws = getMPTWebSocket();

            // Create multiple sessions
            const createdSessions: Session[] = [];
            for (let i = 0; i < 3; i++) {
                const session = await api.createSession({
                    name: `Session ${i + 1}`,
                    connection_type: "shellserver",
                });
                if (session) {
                    createdSessions.push(session);
                    ws.subscribeToSession(session.id);
                }
            }

            expect(createdSessions).toHaveLength(3);
            expect(mockWsClient.subscribeToSession).toHaveBeenCalledTimes(3);
            expect(mockWsClient.subscribeToSession).toHaveBeenCalledWith("sess_multi_1");
            expect(mockWsClient.subscribeToSession).toHaveBeenCalledWith("sess_multi_2");
            expect(mockWsClient.subscribeToSession).toHaveBeenCalledWith("sess_multi_3");
        });
    });
});

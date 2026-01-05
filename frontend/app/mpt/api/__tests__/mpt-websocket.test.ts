// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for MPT WebSocket Handler
// Tests the WebSocket handler for real-time session updates

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MPTWebSocket, getMPTWebSocket, initMPTWebSocket } from "../mpt-websocket";

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState: number = MockWebSocket.CONNECTING;
    url: string;
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;

    sentMessages: string[] = [];
    closeCode: number | null = null;
    closeReason: string | null = null;

    constructor(url: string) {
        this.url = url;
    }

    send(data: string): void {
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }
        this.sentMessages.push(data);
    }

    close(code?: number, reason?: string): void {
        this.closeCode = code ?? 1000;
        this.closeReason = reason ?? "";
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            this.onclose({ wasClean: true, code: this.closeCode, reason: this.closeReason } as CloseEvent);
        }
    }

    // Helper to simulate connection open
    simulateOpen(): void {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
            this.onopen(new Event("open"));
        }
    }

    // Helper to simulate message received
    simulateMessage(data: unknown): void {
        if (this.onmessage) {
            this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
        }
    }

    // Helper to simulate error
    simulateError(): void {
        if (this.onerror) {
            this.onerror(new Event("error"));
        }
    }

    // Helper to simulate connection close
    simulateClose(wasClean: boolean = true, code: number = 1000): void {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            this.onclose({ wasClean, code, reason: "" } as CloseEvent);
        }
    }
}

// Store mock WebSocket instances for testing
let mockWebSocketInstances: MockWebSocket[] = [];

// Mock global WebSocket
vi.stubGlobal("WebSocket", class extends MockWebSocket {
    constructor(url: string) {
        super(url);
        mockWebSocketInstances.push(this);
    }
});

describe("MPTWebSocket", () => {
    let ws: MPTWebSocket;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockWebSocketInstances = [];
        ws = new MPTWebSocket({
            url: "ws://test:9876/ws",
            autoReconnect: false,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe("constructor", () => {
        it("should use default URL when not provided", () => {
            const defaultWs = new MPTWebSocket();
            expect(defaultWs).toBeInstanceOf(MPTWebSocket);
        });

        it("should accept custom configuration", () => {
            const customWs = new MPTWebSocket({
                url: "ws://custom:8080/ws",
                token: "test-token",
                autoReconnect: true,
                maxReconnectAttempts: 10,
                reconnectDelay: 5000,
            });
            expect(customWs).toBeInstanceOf(MPTWebSocket);
        });
    });

    describe("connect()", () => {
        it("should establish WebSocket connection", async () => {
            const connectPromise = ws.connect();

            // Get the mock instance
            const mockWs = mockWebSocketInstances[0];
            expect(mockWs).toBeDefined();
            expect(mockWs.url).toBe("ws://test:9876/ws");

            // Simulate successful connection
            mockWs.simulateOpen();

            await connectPromise;

            expect(ws.isConnected()).toBe(true);
            expect(ws.getStatus()).toBe("connected");
        });

        it("should send auth message when token is provided", async () => {
            const authWs = new MPTWebSocket({
                url: "ws://test:9876/ws",
                token: "auth-token-123",
                autoReconnect: false,
            });

            const connectPromise = authWs.connect();

            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();

            await connectPromise;

            // Check that auth message was sent
            expect(mockWs.sentMessages).toHaveLength(1);
            const authMessage = JSON.parse(mockWs.sentMessages[0]);
            expect(authMessage.type).toBe("auth");
            expect(authMessage.token).toBe("auth-token-123");
        });

        it("should reject on connection error", async () => {
            const connectPromise = ws.connect();

            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateError();

            await expect(connectPromise).rejects.toThrow("WebSocket connection error");
            expect(ws.getStatus()).toBe("error");
        });

        it("should resolve immediately if already connected", async () => {
            // First connection
            const connectPromise1 = ws.connect();
            mockWebSocketInstances[0].simulateOpen();
            await connectPromise1;

            // Second connection should resolve immediately
            await ws.connect();
            expect(mockWebSocketInstances).toHaveLength(1); // No new WebSocket created
        });
    });

    describe("disconnect()", () => {
        it("should close WebSocket connection", async () => {
            const connectPromise = ws.connect();
            mockWebSocketInstances[0].simulateOpen();
            await connectPromise;

            ws.disconnect();

            expect(ws.isConnected()).toBe(false);
            expect(ws.getStatus()).toBe("disconnected");
        });

        it("should close with proper code and reason", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            ws.disconnect();

            expect(mockWs.closeCode).toBe(1000);
            expect(mockWs.closeReason).toBe("Client disconnect");
        });
    });

    describe("subscribeToSession()", () => {
        it("should send subscription message when connected", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const result = ws.subscribeToSession("session-123");

            expect(result).toBe(true);
            const lastMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]);
            expect(lastMessage.type).toBe("subscribe:session");
            expect(lastMessage.session_id).toBe("session-123");
        });

        it("should queue message when disconnected", () => {
            // Don't connect, just try to subscribe
            const result = ws.subscribeToSession("session-456");

            // Should return true because message is queued
            expect(result).toBe(true);
        });
    });

    describe("unsubscribeFromSession()", () => {
        it("should send unsubscribe message", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const result = ws.unsubscribeFromSession("session-789");

            expect(result).toBe(true);
            const lastMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]);
            expect(lastMessage.type).toBe("unsubscribe:session");
            expect(lastMessage.session_id).toBe("session-789");
        });
    });

    describe("executeCommand()", () => {
        it("should send execute command message", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const requestId = ws.executeCommand("session-1", "hostory server001");

            expect(requestId).not.toBeNull();
            expect(requestId).toMatch(/^cmd_/);

            const lastMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]);
            expect(lastMessage.type).toBe("execute:command");
            expect(lastMessage.session_id).toBe("session-1");
            expect(lastMessage.command).toBe("hostory server001");
        });

        it("should use provided request ID", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const requestId = ws.executeCommand("session-1", "cmd", "custom-req-id");

            expect(requestId).toBe("custom-req-id");
        });
    });

    describe("message handling", () => {
        it("should handle session output messages", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const outputCallback = vi.fn();
            ws.onOutput("session-1", outputCallback);

            mockWs.simulateMessage({
                type: "session:output",
                data: {
                    session_id: "session-1",
                    data: "Output line 1",
                    timestamp: "2025-01-05T00:00:00Z",
                },
            });

            expect(outputCallback).toHaveBeenCalledWith({
                sessionId: "session-1",
                data: "Output line 1",
                timestamp: "2025-01-05T00:00:00Z",
            });
        });

        it("should handle session status messages", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const statusCallback = vi.fn();
            ws.onStatus("session-1", statusCallback);

            mockWs.simulateMessage({
                type: "session:status",
                data: {
                    session_id: "session-1",
                    status: "connected",
                    timestamp: "2025-01-05T00:00:00Z",
                },
            });

            expect(statusCallback).toHaveBeenCalledWith({
                sessionId: "session-1",
                status: "connected",
                timestamp: "2025-01-05T00:00:00Z",
            });
        });

        it("should handle command complete messages", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const commandCallback = vi.fn();
            ws.onCommandComplete("req-123", commandCallback);

            mockWs.simulateMessage({
                type: "command:complete",
                data: {
                    request_id: "req-123",
                    session_id: "session-1",
                    exit_code: 0,
                    output: "Command output",
                },
            });

            expect(commandCallback).toHaveBeenCalledWith({
                requestId: "req-123",
                sessionId: "session-1",
                exitCode: 0,
                output: "Command output",
            });
        });

        it("should handle error messages", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const errorCallback = vi.fn();
            ws.onError(errorCallback);

            mockWs.simulateMessage({
                type: "error",
                code: "SESSION_ERROR",
                message: "Session not found",
            });

            expect(errorCallback).toHaveBeenCalledWith("SESSION_ERROR", "Session not found");
        });

        it("should notify wildcard subscribers", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const wildcardCallback = vi.fn();
            ws.onOutput("*", wildcardCallback);

            mockWs.simulateMessage({
                type: "session:output",
                data: {
                    session_id: "any-session",
                    data: "Some output",
                    timestamp: "2025-01-05T00:00:00Z",
                },
            });

            expect(wildcardCallback).toHaveBeenCalled();
        });
    });

    describe("callback registration", () => {
        it("should return unsubscribe function for output callback", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const callback = vi.fn();
            const unsubscribe = ws.onOutput("session-1", callback);

            // Send a message
            mockWs.simulateMessage({
                type: "session:output",
                data: { session_id: "session-1", data: "test", timestamp: "" },
            });
            expect(callback).toHaveBeenCalledTimes(1);

            // Unsubscribe
            unsubscribe();

            // Send another message
            mockWs.simulateMessage({
                type: "session:output",
                data: { session_id: "session-1", data: "test2", timestamp: "" },
            });
            expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        it("should support multiple callbacks for same session", async () => {
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            const callback1 = vi.fn();
            const callback2 = vi.fn();

            ws.onOutput("session-1", callback1);
            ws.onOutput("session-1", callback2);

            mockWs.simulateMessage({
                type: "session:output",
                data: { session_id: "session-1", data: "test", timestamp: "" },
            });

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it("should notify connection status changes", async () => {
            const connectionCallback = vi.fn();
            ws.onConnectionChange(connectionCallback);

            // Should immediately notify current status
            expect(connectionCallback).toHaveBeenCalledWith("disconnected");

            // Connect
            const connectPromise = ws.connect();
            expect(connectionCallback).toHaveBeenCalledWith("connecting");

            mockWebSocketInstances[0].simulateOpen();
            await connectPromise;

            expect(connectionCallback).toHaveBeenCalledWith("connected");
        });
    });

    describe("message queue", () => {
        it("should queue subscription messages when disconnected", () => {
            // Subscribe while disconnected
            ws.subscribeToSession("session-1");
            ws.subscribeToSession("session-2");

            // Messages should be queued, no WebSocket created yet
            expect(mockWebSocketInstances).toHaveLength(0);
        });

        it("should flush queued messages on connect", async () => {
            // Queue messages while disconnected
            ws.subscribeToSession("session-1");
            ws.subscribeToSession("session-2");

            // Now connect
            const connectPromise = ws.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            // Queued messages should have been sent
            const messages = mockWs.sentMessages.map((m) => JSON.parse(m));
            const subscribeMessages = messages.filter((m) => m.type === "subscribe:session");

            expect(subscribeMessages).toHaveLength(2);
            expect(subscribeMessages[0].session_id).toBe("session-1");
            expect(subscribeMessages[1].session_id).toBe("session-2");
        });
    });

    describe("reconnection", () => {
        it("should attempt reconnect on unexpected close", async () => {
            const reconnectWs = new MPTWebSocket({
                url: "ws://test:9876/ws",
                autoReconnect: true,
                maxReconnectAttempts: 3,
                reconnectDelay: 1000,
            });

            const connectPromise = reconnectWs.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            // Simulate unexpected close
            mockWs.simulateClose(false, 1006);

            expect(reconnectWs.getStatus()).toBe("reconnecting");

            // Advance timer
            vi.advanceTimersByTime(1000);

            // New WebSocket should be created
            expect(mockWebSocketInstances).toHaveLength(2);
        });

        it("should not reconnect on clean close", async () => {
            const reconnectWs = new MPTWebSocket({
                url: "ws://test:9876/ws",
                autoReconnect: true,
            });

            const connectPromise = reconnectWs.connect();
            const mockWs = mockWebSocketInstances[0];
            mockWs.simulateOpen();
            await connectPromise;

            // Simulate clean close
            mockWs.simulateClose(true, 1000);

            expect(reconnectWs.getStatus()).toBe("disconnected");

            // Advance timers
            vi.advanceTimersByTime(10000);

            // No new WebSocket should be created
            expect(mockWebSocketInstances).toHaveLength(1);
        });

        it("should respect max reconnect delay cap", async () => {
            const reconnectWs = new MPTWebSocket({
                url: "ws://test:9876/ws",
                autoReconnect: true,
                maxReconnectAttempts: 10,
                reconnectDelay: 3000, // Base delay
            });

            const connectPromise = reconnectWs.connect();
            mockWebSocketInstances[0].simulateOpen();
            await connectPromise;

            // Simulate first failed connection - status should go to "reconnecting"
            const currentMock = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            currentMock.simulateClose(false, 1006);

            // Immediately after close, status should be "reconnecting" (before connect() is called)
            // Note: After the reconnect timer fires and connect() is called, status becomes "connecting"
            expect(reconnectWs.getStatus()).toBe("reconnecting");

            // Advance time to trigger reconnect
            vi.advanceTimersByTime(3001);

            // After connect() is called, status becomes "connecting"
            expect(reconnectWs.getStatus()).toBe("connecting");
        });
    });
});

describe("Singleton functions", () => {
    beforeEach(() => {
        mockWebSocketInstances = [];
    });

    it("getMPTWebSocket should return same instance", () => {
        const ws1 = getMPTWebSocket();
        const ws2 = getMPTWebSocket();

        expect(ws1).toBe(ws2);
    });

    it("initMPTWebSocket should create new instance", () => {
        const ws1 = getMPTWebSocket();
        const ws2 = initMPTWebSocket({ url: "ws://new:8080/ws" });

        expect(ws1).not.toBe(ws2);
        expect(getMPTWebSocket()).toBe(ws2);
    });
});

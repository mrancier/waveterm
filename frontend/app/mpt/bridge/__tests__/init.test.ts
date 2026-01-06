// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for MPT Bridge Initialization
// Covers initMPTBridge, getMPTBridgeStatus, isBridgeInitialized, shutdownMPTBridge

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the API module
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
    initMPTClient: vi.fn(),
    getMPTClient: vi.fn(() => mockApiClient),
}));

// Mock the WebSocket module
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
    initMPTWebSocket: vi.fn(() => mockWsClient),
    getMPTWebSocket: vi.fn(() => mockWsClient),
}));

// Import after mocks are set up
import {
    initMPTBridge,
    getMPTBridgeStatus,
    isBridgeInitialized,
    shutdownMPTBridge,
    MPTBridgeConfig,
} from "../init";
import { initMPTClient } from "../../api/mpt-api";
import { initMPTWebSocket, getMPTWebSocket } from "../../api/mpt-websocket";

// ============================================================================
// Test Setup
// ============================================================================

describe("MPT Bridge Initialization", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Reset bridge state by calling shutdown
        shutdownMPTBridge();

        // Reset mock implementations to defaults
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(initMPTClient).mockImplementation(() => undefined as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(initMPTWebSocket).mockReturnValue(mockWsClient as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(getMPTWebSocket).mockReturnValue(mockWsClient as any);

        mockApiClient.health.mockResolvedValue({
            status: "healthy",
            version: "1.0.0",
            uptime_seconds: 100,
        });
        mockWsClient.connect.mockResolvedValue(undefined);
    });

    afterEach(() => {
        shutdownMPTBridge();
    });

    // ============================================================================
    // initMPTBridge Tests
    // ============================================================================

    describe("initMPTBridge", () => {
        it("should initialize API client with default config", async () => {
            const status = await initMPTBridge();

            expect(initMPTClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiBase: expect.any(String),
                    timeout: 30000,
                })
            );
            expect(status.apiInitialized).toBe(true);
        });

        it("should initialize WebSocket with default config", async () => {
            await initMPTBridge();

            expect(initMPTWebSocket).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.any(String),
                    autoReconnect: true,
                    maxReconnectAttempts: 5,
                    reconnectDelay: 3000,
                })
            );
        });

        it("should use custom API config when provided", async () => {
            const customConfig: MPTBridgeConfig = {
                api: {
                    apiBase: "http://custom-api:8080/api/v1",
                    token: "test-token",
                    timeout: 60000,
                },
            };

            await initMPTBridge(customConfig);

            expect(initMPTClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiBase: "http://custom-api:8080/api/v1",
                    token: "test-token",
                    timeout: 60000,
                })
            );
        });

        it("should use custom WebSocket config when provided", async () => {
            const customConfig: MPTBridgeConfig = {
                websocket: {
                    url: "ws://custom-ws:9999/ws",
                    autoReconnect: false,
                    maxReconnectAttempts: 10,
                    reconnectDelay: 5000,
                },
            };

            await initMPTBridge(customConfig);

            expect(initMPTWebSocket).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: "ws://custom-ws:9999/ws",
                    autoReconnect: false,
                    maxReconnectAttempts: 10,
                    reconnectDelay: 5000,
                })
            );
        });

        it("should auto-connect WebSocket when autoConnect is true (default)", async () => {
            const status = await initMPTBridge();

            expect(mockWsClient.connect).toHaveBeenCalled();
            expect(status.wsConnected).toBe(true);
            expect(status.wsStatus).toBe("connected");
        });

        it("should not auto-connect WebSocket when autoConnect is false", async () => {
            const status = await initMPTBridge({ autoConnect: false });

            expect(mockWsClient.connect).not.toHaveBeenCalled();
            expect(status.wsConnected).toBe(false);
        });

        it("should check API health after initialization", async () => {
            await initMPTBridge();

            expect(mockApiClient.health).toHaveBeenCalled();
        });

        it("should handle WebSocket connection failure gracefully", async () => {
            mockWsClient.connect.mockRejectedValue(new Error("Connection refused"));

            const status = await initMPTBridge();

            expect(status.wsConnected).toBe(false);
            expect(status.wsStatus).toBe("error");
            expect(status.lastError).toContain("WebSocket connection failed");
        });

        it("should handle API health check failure gracefully", async () => {
            mockApiClient.health.mockRejectedValue(new Error("Backend not running"));

            // Should not throw, just log warning
            const status = await initMPTBridge();

            expect(status.apiInitialized).toBe(true);
        });

        it("should return early if bridge is already initialized", async () => {
            // First initialization
            await initMPTBridge();
            vi.clearAllMocks();

            // Second initialization should return early
            const status = await initMPTBridge();

            expect(initMPTClient).not.toHaveBeenCalled();
            expect(initMPTWebSocket).not.toHaveBeenCalled();
            expect(status.apiInitialized).toBe(true);
        });

        it("should throw error if initialization fails completely", async () => {
            // Mock initMPTClient to throw
            vi.mocked(initMPTClient).mockImplementation(() => {
                throw new Error("Critical failure");
            });

            await expect(initMPTBridge()).rejects.toThrow("Critical failure");
        });

        it("should use API token for WebSocket if not provided separately", async () => {
            const config: MPTBridgeConfig = {
                api: {
                    token: "shared-token",
                },
            };

            await initMPTBridge(config);

            expect(initMPTWebSocket).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: "shared-token",
                })
            );
        });

        it("should prefer WebSocket token over API token if both provided", async () => {
            const config: MPTBridgeConfig = {
                websocket: {
                    token: "ws-token",
                },
                api: {
                    token: "api-token",
                },
            };

            await initMPTBridge(config);

            expect(initMPTWebSocket).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: "ws-token",
                })
            );
        });
    });

    // ============================================================================
    // getMPTBridgeStatus Tests
    // ============================================================================

    describe("getMPTBridgeStatus", () => {
        it("should return initial status before initialization", () => {
            const status = getMPTBridgeStatus();

            expect(status.apiInitialized).toBe(false);
            expect(status.wsConnected).toBe(false);
            expect(status.wsStatus).toBe("disconnected");
            expect(status.lastError).toBeNull();
        });

        it("should return updated status after successful initialization", async () => {
            await initMPTBridge();

            const status = getMPTBridgeStatus();

            expect(status.apiInitialized).toBe(true);
            expect(status.wsConnected).toBe(true);
            expect(status.wsStatus).toBe("connected");
        });

        it("should return a copy of status object (not reference)", async () => {
            await initMPTBridge();

            const status1 = getMPTBridgeStatus();
            const status2 = getMPTBridgeStatus();

            expect(status1).not.toBe(status2);
            expect(status1).toEqual(status2);
        });

        it("should reflect error status after WebSocket failure", async () => {
            mockWsClient.connect.mockRejectedValue(new Error("Network error"));

            await initMPTBridge();

            const status = getMPTBridgeStatus();

            expect(status.wsStatus).toBe("error");
            expect(status.lastError).toContain("Network error");
        });
    });

    // ============================================================================
    // isBridgeInitialized Tests
    // ============================================================================

    describe("isBridgeInitialized", () => {
        it("should return false before initialization", () => {
            expect(isBridgeInitialized()).toBe(false);
        });

        it("should return true after successful initialization", async () => {
            await initMPTBridge();

            expect(isBridgeInitialized()).toBe(true);
        });

        it("should return false after shutdown", async () => {
            await initMPTBridge();
            expect(isBridgeInitialized()).toBe(true);

            shutdownMPTBridge();

            expect(isBridgeInitialized()).toBe(false);
        });

        it("should return true even if WebSocket connection failed", async () => {
            mockWsClient.connect.mockRejectedValue(new Error("Connection failed"));

            await initMPTBridge();

            // Bridge is still considered initialized even with WS failure
            expect(isBridgeInitialized()).toBe(true);
        });
    });

    // ============================================================================
    // shutdownMPTBridge Tests
    // ============================================================================

    describe("shutdownMPTBridge", () => {
        it("should disconnect WebSocket on shutdown", async () => {
            await initMPTBridge();

            shutdownMPTBridge();

            expect(mockWsClient.disconnect).toHaveBeenCalled();
        });

        it("should reset bridge status on shutdown", async () => {
            await initMPTBridge();
            expect(getMPTBridgeStatus().apiInitialized).toBe(true);

            shutdownMPTBridge();

            const status = getMPTBridgeStatus();
            expect(status.apiInitialized).toBe(false);
            expect(status.wsConnected).toBe(false);
            expect(status.wsStatus).toBe("disconnected");
            expect(status.lastError).toBeNull();
        });

        it("should reset initialized flag on shutdown", async () => {
            await initMPTBridge();
            expect(isBridgeInitialized()).toBe(true);

            shutdownMPTBridge();

            expect(isBridgeInitialized()).toBe(false);
        });

        it("should handle shutdown when WebSocket is not initialized", () => {
            // getMPTWebSocket might throw if not initialized
            vi.mocked(getMPTWebSocket).mockImplementation(() => {
                throw new Error("Not initialized");
            });

            // Should not throw
            expect(() => shutdownMPTBridge()).not.toThrow();
        });

        it("should allow re-initialization after shutdown", async () => {
            await initMPTBridge();
            shutdownMPTBridge();
            vi.clearAllMocks();

            const status = await initMPTBridge();

            expect(initMPTClient).toHaveBeenCalled();
            expect(initMPTWebSocket).toHaveBeenCalled();
            expect(status.apiInitialized).toBe(true);
        });
    });

    // ============================================================================
    // Default URL Configuration Tests
    // ============================================================================

    describe("Default URL Configuration", () => {
        it("should use default localhost API base", async () => {
            await initMPTBridge();

            expect(initMPTClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiBase: "http://localhost:9876/api/v1",
                })
            );
        });

        it("should use default localhost WebSocket URL", async () => {
            await initMPTBridge();

            expect(initMPTWebSocket).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: "ws://localhost:9876/ws",
                })
            );
        });
    });

    // ============================================================================
    // Debug Mode Tests
    // ============================================================================

    describe("Debug Mode", () => {
        it("should accept debug flag in config", async () => {
            // This should not throw
            await initMPTBridge({ debug: true });

            expect(isBridgeInitialized()).toBe(true);
        });

        it("should work with debug disabled", async () => {
            await initMPTBridge({ debug: false });

            expect(isBridgeInitialized()).toBe(true);
        });
    });

    // ============================================================================
    // Integration Scenario Tests
    // ============================================================================

    describe("Integration Scenarios", () => {
        it("should handle full lifecycle: init -> use -> shutdown -> reinit", async () => {
            // Initial state
            expect(isBridgeInitialized()).toBe(false);

            // Initialize
            const status1 = await initMPTBridge();
            expect(status1.apiInitialized).toBe(true);
            expect(isBridgeInitialized()).toBe(true);

            // Use the bridge
            const currentStatus = getMPTBridgeStatus();
            expect(currentStatus.wsConnected).toBe(true);

            // Shutdown
            shutdownMPTBridge();
            expect(isBridgeInitialized()).toBe(false);
            expect(getMPTBridgeStatus().apiInitialized).toBe(false);

            // Re-initialize
            vi.clearAllMocks();
            const status2 = await initMPTBridge();
            expect(status2.apiInitialized).toBe(true);
            expect(isBridgeInitialized()).toBe(true);
        });

        it("should handle initialization with connection failure then recovery", async () => {
            // First init with failure
            mockWsClient.connect.mockRejectedValue(new Error("Network unreachable"));
            const status1 = await initMPTBridge();
            expect(status1.wsConnected).toBe(false);
            expect(status1.wsStatus).toBe("error");

            // Shutdown
            shutdownMPTBridge();

            // Re-init with success
            mockWsClient.connect.mockResolvedValue(undefined);
            const status2 = await initMPTBridge();
            expect(status2.wsConnected).toBe(true);
            expect(status2.wsStatus).toBe("connected");
        });
    });
});

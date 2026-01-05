// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Integration tests for MPT Frontend
// Tests full session lifecycle and API interactions with mock daemon

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockDaemon, createMockFetch, MockWebSocket, sleep, createTestSession } from "./mock-daemon";

// Store original fetch
const originalFetch = global.fetch;

describe("MPT Integration Tests", () => {
    let daemon: MockDaemon;
    let mockFetch: ReturnType<typeof createMockFetch>;

    beforeEach(() => {
        vi.clearAllMocks();
        daemon = new MockDaemon();
        mockFetch = createMockFetch(daemon);
        global.fetch = mockFetch;
    });

    afterEach(() => {
        daemon.reset();
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    // =========================================================================
    // Session Lifecycle Tests
    // =========================================================================

    describe("Session Lifecycle", () => {
        it("should create a new session and connect", async () => {
            // Create session
            const response = await fetch("http://localhost:9876/api/v1/sessions", {
                method: "POST",
                body: JSON.stringify({
                    name: "Integration Test Session",
                    connection_type: "od-shellserver",
                    region: "prn",
                }),
            });

            expect(response.ok).toBe(true);
            expect(response.status).toBe(201);

            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.name).toBe("Integration Test Session");
            expect(result.data.status).toBe("connecting");
            expect(result.data.id).toMatch(/^sess_/);

            // Wait for connection
            await sleep(150);

            // Verify connected
            const sessionResponse = await fetch(`http://localhost:9876/api/v1/sessions/${result.data.id}`);
            const sessionData = await sessionResponse.json();
            expect(sessionData.data.status).toBe("connected");
            expect(sessionData.data.hostname).toBeDefined();
        });

        it("should list all sessions", async () => {
            // Create multiple sessions
            createTestSession(daemon, "Session 1", "prn");
            createTestSession(daemon, "Session 2", "frc");
            createTestSession(daemon, "Session 3", "lla");

            const response = await fetch("http://localhost:9876/api/v1/sessions");
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.sessions).toHaveLength(3);
            expect(result.data.total).toBe(3);
        });

        it("should delete a session", async () => {
            const session = createTestSession(daemon);

            // Verify session exists
            let response = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`);
            let result = await response.json();
            expect(result.success).toBe(true);

            // Delete session
            response = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`, {
                method: "DELETE",
            });
            result = await response.json();
            expect(result.success).toBe(true);

            // Verify session is gone
            response = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`);
            result = await response.json();
            expect(result.success).toBe(false);
            expect(response.status).toBe(404);
        });

        it("should reconnect a disconnected session", async () => {
            const session = createTestSession(daemon);
            await sleep(150); // Wait for initial connection

            // Reconnect
            const response = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}/reconnect`, {
                method: "POST",
            });
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.status).toBe("reconnecting");

            // Wait for reconnection
            await sleep(150);

            // Verify reconnected
            const sessionResponse = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`);
            const sessionData = await sessionResponse.json();
            expect(sessionData.data.status).toBe("connected");
        });
    });

    // =========================================================================
    // Command Execution Tests
    // =========================================================================

    describe("Command Execution", () => {
        it("should execute command on connected session", async () => {
            const session = createTestSession(daemon);
            await sleep(150); // Wait for connection

            const response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "echo Hello World",
                }),
            });

            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.status).toBe("completed");
            expect(result.data.exit_code).toBe(0);
            expect(result.data.output).toBe("Hello World");
        });

        it("should handle command with non-zero exit code", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            const response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "invalid-command-xyz",
                }),
            });

            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.data.status).toBe("error");
            expect(result.data.exit_code).toBe(127);
            expect(result.data.output).toContain("command not found");
        });

        it("should fail to execute on non-existent session", async () => {
            const response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: "non-existent-session",
                    command: "whoami",
                }),
            });

            const result = await response.json();
            expect(result.success).toBe(false);
            expect(response.status).toBe(400);
        });

        it("should execute pwd command", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            const response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "pwd",
                }),
            });

            const result = await response.json();
            expect(result.data.output).toBe("/home/user");
        });

        it("should execute whoami command", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            const response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "whoami",
                }),
            });

            const result = await response.json();
            expect(result.data.output).toBe("siteops");
        });
    });

    // =========================================================================
    // Output Retrieval Tests
    // =========================================================================

    describe("Output Retrieval", () => {
        it("should retrieve session output after commands", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Execute some commands
            await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({ session_id: session.id, command: "echo line1" }),
            });
            await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({ session_id: session.id, command: "echo line2" }),
            });

            // Get output
            const response = await fetch(`http://localhost:9876/api/v1/output/${session.id}?lines=10`);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.session_id).toBe(session.id);
            expect(result.data.lines.length).toBeGreaterThan(0);
        });

        it("should search output for pattern", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Execute commands
            await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({ session_id: session.id, command: "echo ERROR: something failed" }),
            });
            await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({ session_id: session.id, command: "echo SUCCESS: all good" }),
            });

            // Search for ERROR
            const response = await fetch(`http://localhost:9876/api/v1/output/${session.id}/search?pattern=ERROR`);
            const result = await response.json();

            expect(result.success).toBe(true);
            const matchingLines = result.data.filter((line: { content: string }) => line.content.includes("ERROR"));
            expect(matchingLines.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // Health and Status Tests
    // =========================================================================

    describe("Health and Status", () => {
        it("should return healthy status", async () => {
            const response = await fetch("http://localhost:9876/api/v1/health");
            const result = await response.json();

            expect(result.status).toBe("healthy");
            expect(result.version).toBe("1.0.0");
            expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
        });

        it("should return daemon status with session counts", async () => {
            // Create some sessions
            createTestSession(daemon, "S1");
            createTestSession(daemon, "S2");

            await sleep(150); // Wait for connections

            const response = await fetch("http://localhost:9876/api/v1/status");
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.sessions.total_created).toBe(2);
            expect(result.data.sessions.active).toBe(2);
        });
    });

    // =========================================================================
    // Error Handling Tests
    // =========================================================================

    describe("Error Handling", () => {
        it("should return 404 for non-existent session", async () => {
            const response = await fetch("http://localhost:9876/api/v1/sessions/fake-session-id");

            expect(response.status).toBe(404);
            const result = await response.json();
            expect(result.success).toBe(false);
            expect(result.error.code).toBe("NOT_FOUND");
        });

        it("should return 404 for unknown endpoint", async () => {
            const response = await fetch("http://localhost:9876/api/v1/unknown-endpoint");

            expect(response.status).toBe(404);
            const result = await response.json();
            expect(result.success).toBe(false);
        });

        it("should fail to delete non-existent session", async () => {
            const response = await fetch("http://localhost:9876/api/v1/sessions/fake-id", {
                method: "DELETE",
            });

            expect(response.status).toBe(404);
            const result = await response.json();
            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // WebSocket Integration Tests
    // =========================================================================

    describe("WebSocket Integration", () => {
        it("should connect and authenticate", async () => {
            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            const messages: unknown[] = [];

            ws.onmessage = (event) => {
                messages.push(JSON.parse(event.data));
            };

            // Wait for connection
            await sleep(100);
            expect(ws.readyState).toBe(MockWebSocket.OPEN);

            // Send auth
            ws.send(JSON.stringify({ type: "auth", token: "test-token" }));
            await sleep(50);

            expect(messages).toContainEqual({ type: "auth:success" });

            ws.close();
        });

        it("should subscribe to session and receive output", async () => {
            const session = createTestSession(daemon);
            await sleep(150); // Wait for session to connect

            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            const messages: unknown[] = [];

            ws.onmessage = (event) => {
                messages.push(JSON.parse(event.data));
            };

            await sleep(100);

            // Subscribe to session
            ws.send(JSON.stringify({ type: "subscribe:session", session_id: session.id }));

            // Execute command via WebSocket
            ws.send(
                JSON.stringify({
                    type: "execute:command",
                    session_id: session.id,
                    command: "echo test-output",
                    request_id: "test-req-1",
                })
            );

            await sleep(100);

            // Should receive output and completion
            const outputMsg = messages.find(
                (m: unknown) => (m as { type: string }).type === "session:output"
            );
            const completeMsg = messages.find(
                (m: unknown) => (m as { type: string }).type === "command:complete"
            );

            expect(outputMsg).toBeDefined();
            expect(completeMsg).toBeDefined();
            expect((completeMsg as { data: { exit_code: number } }).data.exit_code).toBe(0);

            ws.close();
        });

        it("should handle execute on disconnected session via WebSocket", async () => {
            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            const messages: unknown[] = [];

            ws.onmessage = (event) => {
                messages.push(JSON.parse(event.data));
            };

            await sleep(100);

            // Try to execute on non-existent session
            ws.send(
                JSON.stringify({
                    type: "execute:command",
                    session_id: "fake-session",
                    command: "whoami",
                })
            );

            await sleep(50);

            const errorMsg = messages.find(
                (m: unknown) => (m as { type: string }).type === "error"
            );
            expect(errorMsg).toBeDefined();
            expect((errorMsg as { code: string }).code).toBe("EXECUTE_FAILED");

            ws.close();
        });

        it("should handle WebSocket close gracefully", async () => {
            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            let closeCalled = false;

            ws.onclose = () => {
                closeCalled = true;
            };

            await sleep(100);
            ws.close(1000, "Test close");

            expect(ws.readyState).toBe(MockWebSocket.CLOSED);
            expect(closeCalled).toBe(true);
        });

        it("should handle unknown message type", async () => {
            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            const messages: unknown[] = [];

            ws.onmessage = (event) => {
                messages.push(JSON.parse(event.data));
            };

            await sleep(100);

            ws.send(JSON.stringify({ type: "unknown:message" }));
            await sleep(50);

            const errorMsg = messages.find(
                (m: unknown) => (m as { type: string }).type === "error"
            );
            expect(errorMsg).toBeDefined();
            expect((errorMsg as { code: string }).code).toBe("UNKNOWN_MESSAGE");

            ws.close();
        });
    });

    // =========================================================================
    // Full Workflow Tests
    // =========================================================================

    describe("Full Workflow", () => {
        it("should complete typical OD session workflow", async () => {
            // 1. Check daemon health
            let response = await fetch("http://localhost:9876/api/v1/health");
            let result = await response.json();
            expect(result.status).toBe("healthy");

            // 2. Create session
            response = await fetch("http://localhost:9876/api/v1/sessions", {
                method: "POST",
                body: JSON.stringify({
                    name: "OD Debug Session",
                    connection_type: "od-shellserver",
                    region: "prn",
                }),
            });
            result = await response.json();
            const sessionId = result.data.id;

            // 3. Wait for connection
            await sleep(150);

            // 4. Verify connected
            response = await fetch(`http://localhost:9876/api/v1/sessions/${sessionId}`);
            result = await response.json();
            expect(result.data.status).toBe("connected");

            // 5. Execute some commands
            response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: sessionId,
                    command: "whoami",
                }),
            });
            result = await response.json();
            expect(result.data.output).toBe("siteops");

            response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: sessionId,
                    command: "pwd",
                }),
            });
            result = await response.json();
            expect(result.data.output).toBe("/home/user");

            // 6. Get output history
            response = await fetch(`http://localhost:9876/api/v1/output/${sessionId}`);
            result = await response.json();
            expect(result.data.lines.length).toBeGreaterThan(0);

            // 7. Clean up - delete session
            response = await fetch(`http://localhost:9876/api/v1/sessions/${sessionId}`, {
                method: "DELETE",
            });
            result = await response.json();
            expect(result.success).toBe(true);
        });

        it("should handle multi-session workflow", async () => {
            // Create 3 sessions
            const sessions = [];
            for (let i = 1; i <= 3; i++) {
                const response = await fetch("http://localhost:9876/api/v1/sessions", {
                    method: "POST",
                    body: JSON.stringify({
                        name: `Session ${i}`,
                        connection_type: "od-shellserver",
                        region: i === 1 ? "prn" : i === 2 ? "frc" : "lla",
                    }),
                });
                const result = await response.json();
                sessions.push(result.data);
            }

            await sleep(150);

            // Execute command on each
            for (const session of sessions) {
                const response = await fetch("http://localhost:9876/api/v1/execute", {
                    method: "POST",
                    body: JSON.stringify({
                        session_id: session.id,
                        command: `echo Hello from ${session.name}`,
                    }),
                });
                const result = await response.json();
                expect(result.data.output).toBe(`Hello from ${session.name}`);
            }

            // Verify all sessions listed
            const listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            const listResult = await listResponse.json();
            expect(listResult.data.total).toBe(3);

            // Clean up
            for (const session of sessions) {
                await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`, {
                    method: "DELETE",
                });
            }
        });
    });
});

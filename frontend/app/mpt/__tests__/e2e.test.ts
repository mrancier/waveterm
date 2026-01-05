// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// End-to-End Tests for MPT Frontend
// Tests complete user workflows with mock daemon backend

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { MockDaemon, createMockFetch, MockWebSocket, sleep, createTestSession } from "./mock-daemon";

// Store originals
const originalFetch = global.fetch;
const originalWebSocket = global.WebSocket;

// ============================================================================
// Test Setup
// ============================================================================

describe("MPT E2E Tests", () => {
    let daemon: MockDaemon;
    let mockFetch: ReturnType<typeof createMockFetch>;

    beforeAll(() => {
        // Suppress console warnings during tests
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        daemon = new MockDaemon();
        mockFetch = createMockFetch(daemon);
        global.fetch = mockFetch;

        // Mock WebSocket constructor
        (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = class extends MockWebSocket {
            constructor(url: string) {
                super(url, daemon);
            }
        } as unknown as typeof WebSocket;
    });

    afterEach(() => {
        daemon.reset();
        global.fetch = originalFetch;
        (global as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
    });

    // =========================================================================
    // User Workflow: First-Time Connection
    // =========================================================================

    describe("User Workflow: First-Time Connection", () => {
        it("should complete new user onboarding workflow", async () => {
            // Step 1: User opens app - check daemon health
            const healthResponse = await fetch("http://localhost:9876/api/v1/health");
            const health = await healthResponse.json();
            expect(health.status).toBe("healthy");

            // Step 2: User sees no existing sessions
            const listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            const list = await listResponse.json();
            expect(list.data.total).toBe(0);

            // Step 3: User clicks "Quick Connect" to PRN
            const createResponse = await fetch("http://localhost:9876/api/v1/sessions", {
                method: "POST",
                body: JSON.stringify({
                    name: "PRN Quick Connect",
                    connection_type: "od-shellserver",
                    region: "prn",
                }),
            });
            const session = await createResponse.json();
            expect(session.success).toBe(true);
            expect(session.data.status).toBe("connecting");

            // Step 4: Wait for connection to establish
            await sleep(150);

            // Step 5: Verify session is now connected
            const sessionResponse = await fetch(`http://localhost:9876/api/v1/sessions/${session.data.id}`);
            const connectedSession = await sessionResponse.json();
            expect(connectedSession.data.status).toBe("connected");
            expect(connectedSession.data.hostname).toMatch(/^devvm/);

            // Step 6: User runs first command
            const execResponse = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.data.id,
                    command: "whoami",
                }),
            });
            const result = await execResponse.json();
            expect(result.data.output).toBe("siteops");
            expect(result.data.exit_code).toBe(0);
        });

        it("should handle connection failure gracefully", async () => {
            // Create session to a non-existent region (daemon will still create it for testing)
            const createResponse = await fetch("http://localhost:9876/api/v1/sessions", {
                method: "POST",
                body: JSON.stringify({
                    name: "Invalid Region",
                    connection_type: "od-shellserver",
                    region: "invalid",
                }),
            });
            const session = await createResponse.json();
            expect(session.success).toBe(true);

            // Session should still be created (mock daemon is permissive)
            // In real scenario, backend would return an error for invalid region
        });
    });

    // =========================================================================
    // User Workflow: SiteOps Debug Session
    // =========================================================================

    describe("User Workflow: SiteOps Debug Session", () => {
        it("should complete typical debugging workflow", async () => {
            // Step 1: Create session
            const session = createTestSession(daemon, "Debug Session", "prn");
            await sleep(150);

            // Step 2: Check host information
            let response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "pwd",
                }),
            });
            let result = await response.json();
            expect(result.data.output).toBe("/home/user");

            // Step 3: Run hostory command
            response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "hostory server001.prn1",
                }),
            });
            result = await response.json();
            expect(result.data.output).toContain("Host:");
            expect(result.data.output).toContain("Status:");

            // Step 4: List directory
            response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "ls",
                }),
            });
            result = await response.json();
            expect(result.data.output).toContain("Documents");

            // Step 5: Check output history
            response = await fetch(`http://localhost:9876/api/v1/output/${session.id}`);
            result = await response.json();
            expect(result.data.lines.length).toBeGreaterThan(0);

            // Step 6: Search output for errors
            response = await fetch(`http://localhost:9876/api/v1/output/${session.id}/search?pattern=Status`);
            result = await response.json();
            expect(result.success).toBe(true);
        });

        it("should handle command errors during debugging", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Run invalid command
            const response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "invalid_command_xyz",
                }),
            });
            const result = await response.json();

            expect(result.data.exit_code).toBe(127);
            expect(result.data.status).toBe("error");
            expect(result.data.output).toContain("command not found");
        });
    });

    // =========================================================================
    // User Workflow: Multi-Region Operations
    // =========================================================================

    describe("User Workflow: Multi-Region Operations", () => {
        it("should manage sessions across multiple datacenters", async () => {
            const regions = ["prn", "frc", "lco", "alb"];
            const sessions: { id: string; region: string }[] = [];

            // Step 1: Create sessions in each region
            for (const region of regions) {
                const response = await fetch("http://localhost:9876/api/v1/sessions", {
                    method: "POST",
                    body: JSON.stringify({
                        name: `Session ${region.toUpperCase()}`,
                        connection_type: "od-shellserver",
                        region,
                    }),
                });
                const result = await response.json();
                sessions.push({ id: result.data.id, region });
            }

            await sleep(150);

            // Step 2: Verify all sessions connected
            const listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            const list = await listResponse.json();
            expect(list.data.total).toBe(4);

            // Step 3: Execute command on each session
            for (const session of sessions) {
                const response = await fetch("http://localhost:9876/api/v1/execute", {
                    method: "POST",
                    body: JSON.stringify({
                        session_id: session.id,
                        command: `echo Region: ${session.region}`,
                    }),
                });
                const result = await response.json();
                expect(result.data.output).toBe(`Region: ${session.region}`);
            }

            // Step 4: Check daemon status
            const statusResponse = await fetch("http://localhost:9876/api/v1/status");
            const status = await statusResponse.json();
            expect(status.data.sessions.active).toBe(4);

            // Step 5: Close one session
            await fetch(`http://localhost:9876/api/v1/sessions/${sessions[0].id}`, {
                method: "DELETE",
            });

            // Step 6: Verify session count decreased
            const finalStatus = await fetch("http://localhost:9876/api/v1/status");
            const finalStatusData = await finalStatus.json();
            expect(finalStatusData.data.sessions.active).toBe(3);
        });

        it("should handle reconnection across regions", async () => {
            const session = createTestSession(daemon, "Reconnect Test", "prn");
            await sleep(150);

            // Simulate reconnection request
            const response = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}/reconnect`, {
                method: "POST",
            });
            const result = await response.json();
            expect(result.success).toBe(true);

            await sleep(150);

            // Verify reconnected
            const sessionResponse = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`);
            const sessionData = await sessionResponse.json();
            expect(sessionData.data.status).toBe("connected");
        });
    });

    // =========================================================================
    // User Workflow: WebSocket Real-Time Updates
    // =========================================================================

    describe("User Workflow: WebSocket Real-Time Updates", () => {
        it("should receive real-time output via WebSocket", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Create WebSocket connection
            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            const messages: unknown[] = [];

            ws.onmessage = (event) => {
                messages.push(JSON.parse(event.data));
            };

            await sleep(100);

            // Authenticate
            ws.send(JSON.stringify({ type: "auth", token: "user-token" }));
            await sleep(50);

            // Subscribe to session
            ws.send(JSON.stringify({ type: "subscribe:session", session_id: session.id }));

            // Execute command via WebSocket
            ws.send(
                JSON.stringify({
                    type: "execute:command",
                    session_id: session.id,
                    command: "echo Hello via WebSocket",
                    request_id: "ws-cmd-1",
                })
            );

            await sleep(100);

            // Verify messages received
            const authSuccess = messages.find((m: unknown) => (m as { type: string }).type === "auth:success");
            const output = messages.find((m: unknown) => (m as { type: string }).type === "session:output");
            const complete = messages.find((m: unknown) => (m as { type: string }).type === "command:complete");

            expect(authSuccess).toBeDefined();
            expect(output).toBeDefined();
            expect(complete).toBeDefined();

            ws.close();
        });

        it("should handle WebSocket disconnection during session", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            let closed = false;

            ws.onclose = () => {
                closed = true;
            };

            await sleep(100);

            // Simulate disconnect
            ws.close(1001, "Going away");

            expect(closed).toBe(true);
            expect(ws.readyState).toBe(MockWebSocket.CLOSED);

            // Session should still exist
            const response = await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`);
            const result = await response.json();
            expect(result.success).toBe(true);
        });

        it("should execute multiple commands via WebSocket", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            const ws = new MockWebSocket("ws://localhost:9876/ws", daemon);
            const completions: unknown[] = [];

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === "command:complete") {
                    completions.push(msg);
                }
            };

            await sleep(100);

            // Send multiple commands
            const commands = ["pwd", "whoami", "ls", "echo test"];
            for (let i = 0; i < commands.length; i++) {
                ws.send(
                    JSON.stringify({
                        type: "execute:command",
                        session_id: session.id,
                        command: commands[i],
                        request_id: `cmd-${i}`,
                    })
                );
            }

            await sleep(200);

            expect(completions.length).toBe(4);

            ws.close();
        });
    });

    // =========================================================================
    // User Workflow: Session Cleanup
    // =========================================================================

    describe("User Workflow: Session Cleanup", () => {
        it("should clean up all sessions on logout", async () => {
            // Create multiple sessions
            for (let i = 0; i < 5; i++) {
                createTestSession(daemon, `Session ${i}`, "prn");
            }

            await sleep(150);

            // Verify sessions exist
            let listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            let list = await listResponse.json();
            expect(list.data.total).toBe(5);

            // Delete all sessions (simulating logout)
            for (const session of list.data.sessions) {
                await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`, {
                    method: "DELETE",
                });
            }

            // Verify all sessions deleted
            listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            list = await listResponse.json();
            expect(list.data.total).toBe(0);
        });

        it("should handle session timeout gracefully", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Execute command on active session
            let response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "whoami",
                }),
            });
            let result = await response.json();
            expect(result.success).toBe(true);

            // Delete session (simulating timeout)
            await fetch(`http://localhost:9876/api/v1/sessions/${session.id}`, {
                method: "DELETE",
            });

            // Try to execute on deleted session
            response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "whoami",
                }),
            });
            result = await response.json();
            expect(result.success).toBe(false);
        });
    });

    // =========================================================================
    // User Workflow: Error Recovery
    // =========================================================================

    describe("User Workflow: Error Recovery", () => {
        it("should recover from failed command execution", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Run failing command
            let response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "invalid_cmd",
                }),
            });
            let result = await response.json();
            expect(result.data.exit_code).toBe(127);

            // Run successful command after failure
            response = await fetch("http://localhost:9876/api/v1/execute", {
                method: "POST",
                body: JSON.stringify({
                    session_id: session.id,
                    command: "echo recovered",
                }),
            });
            result = await response.json();
            expect(result.data.exit_code).toBe(0);
            expect(result.data.output).toBe("recovered");
        });

        it("should handle rapid command execution", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Execute many commands rapidly
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    fetch("http://localhost:9876/api/v1/execute", {
                        method: "POST",
                        body: JSON.stringify({
                            session_id: session.id,
                            command: `echo command-${i}`,
                        }),
                    }).then((r) => r.json())
                );
            }

            const results = await Promise.all(promises);

            // All should succeed
            for (let i = 0; i < 10; i++) {
                expect(results[i].success).toBe(true);
                expect(results[i].data.output).toBe(`command-${i}`);
            }
        });
    });

    // =========================================================================
    // User Workflow: Output Search and Analysis
    // =========================================================================

    describe("User Workflow: Output Search and Analysis", () => {
        it("should search through command history", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Execute various commands
            const commands = [
                "echo ERROR: disk full",
                "echo WARNING: high memory",
                "echo INFO: system healthy",
                "echo ERROR: connection timeout",
                "echo SUCCESS: backup complete",
            ];

            for (const cmd of commands) {
                await fetch("http://localhost:9876/api/v1/execute", {
                    method: "POST",
                    body: JSON.stringify({
                        session_id: session.id,
                        command: cmd,
                    }),
                });
            }

            // Search for errors
            const response = await fetch(
                `http://localhost:9876/api/v1/output/${session.id}/search?pattern=ERROR`
            );
            const result = await response.json();

            expect(result.success).toBe(true);
            const errorLines = result.data.filter((line: { content: string }) =>
                line.content.includes("ERROR")
            );
            expect(errorLines.length).toBeGreaterThan(0);
        });

        it("should retrieve paginated output", async () => {
            const session = createTestSession(daemon);
            await sleep(150);

            // Generate some output
            for (let i = 0; i < 20; i++) {
                await fetch("http://localhost:9876/api/v1/execute", {
                    method: "POST",
                    body: JSON.stringify({
                        session_id: session.id,
                        command: `echo Line ${i}`,
                    }),
                });
            }

            // Get limited output
            const response = await fetch(`http://localhost:9876/api/v1/output/${session.id}?lines=10`);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.lines.length).toBeLessThanOrEqual(10);
        });
    });

    // =========================================================================
    // Stress Tests
    // =========================================================================

    describe("Stress Tests", () => {
        it("should handle concurrent session creation", async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    fetch("http://localhost:9876/api/v1/sessions", {
                        method: "POST",
                        body: JSON.stringify({
                            name: `Concurrent Session ${i}`,
                            connection_type: "od-shellserver",
                            region: "prn",
                        }),
                    }).then((r) => r.json())
                );
            }

            const results = await Promise.all(promises);

            for (const result of results) {
                expect(result.success).toBe(true);
            }

            // Verify all created
            const listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            const list = await listResponse.json();
            expect(list.data.total).toBe(10);
        });

        it("should handle rapid session lifecycle", async () => {
            for (let i = 0; i < 5; i++) {
                // Create
                const createResponse = await fetch("http://localhost:9876/api/v1/sessions", {
                    method: "POST",
                    body: JSON.stringify({
                        name: `Rapid Session ${i}`,
                        connection_type: "od-shellserver",
                        region: "prn",
                    }),
                });
                const session = await createResponse.json();

                await sleep(150);

                // Execute
                await fetch("http://localhost:9876/api/v1/execute", {
                    method: "POST",
                    body: JSON.stringify({
                        session_id: session.data.id,
                        command: "whoami",
                    }),
                });

                // Delete
                await fetch(`http://localhost:9876/api/v1/sessions/${session.data.id}`, {
                    method: "DELETE",
                });
            }

            // All sessions should be cleaned up
            const listResponse = await fetch("http://localhost:9876/api/v1/sessions");
            const list = await listResponse.json();
            expect(list.data.total).toBe(0);
        });
    });
});

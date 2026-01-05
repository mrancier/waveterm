// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for MPT API Client
// Tests the TypeScript API client for MPT backend communication

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MPTAPIClient, getMPTClient, initMPTClient } from "../mpt-api";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MPTAPIClient", () => {
    let client: MPTAPIClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new MPTAPIClient({
            apiBase: "http://test-api:9876/api/v1",
            timeout: 5000,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("constructor", () => {
        it("should use default API base when not provided", () => {
            const defaultClient = new MPTAPIClient();
            // We can't directly access private properties, but we can verify behavior
            expect(defaultClient).toBeInstanceOf(MPTAPIClient);
        });

        it("should accept custom configuration", () => {
            const customClient = new MPTAPIClient({
                apiBase: "http://custom:8080/api",
                token: "test-token",
                timeout: 10000,
            });
            expect(customClient).toBeInstanceOf(MPTAPIClient);
        });
    });

    describe("health()", () => {
        it("should return health data on success", async () => {
            const healthResponse = {
                success: true,
                data: {
                    status: "healthy",
                    version: "1.0.0",
                    uptime_seconds: 3600,
                },
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve(healthResponse),
            });

            const result = await client.health();

            expect(result).toEqual(healthResponse.data);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://test-api:9876/api/v1/health",
                expect.objectContaining({
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                })
            );
        });

        it("should return null on failure", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () =>
                    Promise.resolve({
                        success: false,
                        error: { code: "SERVER_ERROR", message: "Internal error" },
                    }),
            });

            const result = await client.health();

            expect(result).toBeNull();
        });

        it("should return null when data is missing", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true }),
            });

            const result = await client.health();

            expect(result).toBeNull();
        });

        it("should handle network errors", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network failure"));

            const result = await client.health();

            expect(result).toBeNull();
        });
    });

    describe("listSessions()", () => {
        it("should return sessions list on success", async () => {
            const sessionsResponse = {
                success: true,
                data: {
                    sessions: [
                        {
                            id: "session-1",
                            name: "Test Session",
                            status: "connected",
                            connection_type: "shellserver",
                            region: "prn",
                            created_at: "2025-01-05T00:00:00Z",
                            last_activity: "2025-01-05T01:00:00Z",
                        },
                    ],
                    total: 1,
                },
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve(sessionsResponse),
            });

            const result = await client.listSessions();

            expect(result).toEqual(sessionsResponse.data);
            expect(result?.sessions).toHaveLength(1);
            expect(result?.sessions[0].id).toBe("session-1");
        });

        it("should return null on failure", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false }),
            });

            const result = await client.listSessions();

            expect(result).toBeNull();
        });
    });

    describe("createSession()", () => {
        it("should create and return new session", async () => {
            const newSession = {
                id: "new-session-123",
                name: "New OD Session",
                status: "connecting",
                connection_type: "shellserver",
                region: "frc",
                created_at: "2025-01-05T12:00:00Z",
                last_activity: "2025-01-05T12:00:00Z",
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: newSession }),
            });

            const result = await client.createSession({
                name: "New OD Session",
                connection_type: "shellserver",
                region: "frc",
            });

            expect(result).toEqual(newSession);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://test-api:9876/api/v1/sessions",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        name: "New OD Session",
                        connection_type: "shellserver",
                        region: "frc",
                    }),
                })
            );
        });

        it("should return null when creation fails", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () =>
                    Promise.resolve({
                        success: false,
                        error: { code: "CREATION_FAILED", message: "Could not create session" },
                    }),
            });

            const result = await client.createSession({
                name: "Failed Session",
                connection_type: "shellserver",
            });

            expect(result).toBeNull();
        });
    });

    describe("getSession()", () => {
        it("should return session by ID", async () => {
            const session = {
                id: "session-abc",
                name: "Test Session",
                status: "connected",
                connection_type: "shellserver",
                created_at: "2025-01-05T00:00:00Z",
                last_activity: "2025-01-05T01:00:00Z",
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: session }),
            });

            const result = await client.getSession("session-abc");

            expect(result).toEqual(session);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://test-api:9876/api/v1/sessions/session-abc",
                expect.any(Object)
            );
        });

        it("should return null for non-existent session", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () =>
                    Promise.resolve({
                        success: false,
                        error: { code: "NOT_FOUND", message: "Session not found" },
                    }),
            });

            const result = await client.getSession("non-existent");

            expect(result).toBeNull();
        });
    });

    describe("deleteSession()", () => {
        it("should return true on successful deletion", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: { id: "session-to-delete", status: "deleted" },
                    }),
            });

            const result = await client.deleteSession("session-to-delete");

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://test-api:9876/api/v1/sessions/session-to-delete",
                expect.objectContaining({ method: "DELETE" })
            );
        });

        it("should return false on deletion failure", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false }),
            });

            const result = await client.deleteSession("session-id");

            expect(result).toBe(false);
        });
    });

    describe("execute()", () => {
        it("should execute command and return result", async () => {
            const executionResult = {
                request_id: "req-123",
                session_id: "session-1",
                command: "hostory server001",
                status: "completed",
                exit_code: 0,
                output: "Host history output...",
                execution_time_ms: 1500,
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: executionResult }),
            });

            const result = await client.execute({
                session_id: "session-1",
                command: "hostory server001",
            });

            expect(result).toEqual(executionResult);
            expect(result?.exit_code).toBe(0);
            expect(result?.status).toBe("completed");
        });

        it("should return null on execution failure", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () =>
                    Promise.resolve({
                        success: false,
                        error: { code: "EXEC_ERROR", message: "Command failed" },
                    }),
            });

            const result = await client.execute({
                session_id: "session-1",
                command: "invalid-command",
            });

            expect(result).toBeNull();
        });
    });

    describe("executeMulti()", () => {
        it("should execute command on multiple sessions", async () => {
            const multiResult = {
                request_id: "multi-req-1",
                results: [
                    { request_id: "r1", session_id: "s1", command: "cmd", status: "completed", exit_code: 0, output: "out1", execution_time_ms: 100 },
                    { request_id: "r2", session_id: "s2", command: "cmd", status: "completed", exit_code: 0, output: "out2", execution_time_ms: 150 },
                ],
                summary: { total: 2, completed: 2, failed: 0 },
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: multiResult }),
            });

            const result = await client.executeMulti({
                session_ids: ["s1", "s2"],
                command: "cmd",
            });

            expect(result?.results).toHaveLength(2);
            expect(result?.summary.completed).toBe(2);
            expect(result?.summary.failed).toBe(0);
        });
    });

    describe("getOutput()", () => {
        it("should return session output", async () => {
            const outputResponse = {
                session_id: "session-1",
                lines: [
                    { timestamp: "2025-01-05T00:00:00Z", content: "Line 1" },
                    { timestamp: "2025-01-05T00:00:01Z", content: "Line 2" },
                ],
                total_lines: 2,
            };

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: outputResponse }),
            });

            const result = await client.getOutput("session-1", 100);

            expect(result?.lines).toHaveLength(2);
            expect(result?.total_lines).toBe(2);
            expect(mockFetch).toHaveBeenCalledWith(
                "http://test-api:9876/api/v1/output/session-1?lines=100",
                expect.any(Object)
            );
        });
    });

    describe("authentication", () => {
        it("should include Authorization header when token is set", async () => {
            const authenticatedClient = new MPTAPIClient({
                apiBase: "http://test-api:9876/api/v1",
                token: "bearer-token-123",
            });

            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: { status: "ok" } }),
            });

            await authenticatedClient.health();

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer bearer-token-123",
                    },
                })
            );
        });
    });

    describe("timeout handling", () => {
        it("should handle AbortError from timeout", async () => {
            // Mock fetch to throw AbortError (simulating timeout)
            const abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            mockFetch.mockRejectedValueOnce(abortError);

            const result = await client.health();

            // Should return null due to AbortError
            expect(result).toBeNull();
        });

        it("should pass signal to fetch for timeout support", async () => {
            mockFetch.mockResolvedValueOnce({
                json: () => Promise.resolve({ success: true, data: { status: "ok" } }),
            });

            await client.health();

            // Verify that fetch was called with a signal option
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    signal: expect.any(AbortSignal),
                })
            );
        });
    });
});

describe("Singleton functions", () => {
    it("getMPTClient should return same instance", () => {
        const client1 = getMPTClient();
        const client2 = getMPTClient();

        expect(client1).toBe(client2);
    });

    it("initMPTClient should create new instance", () => {
        const client1 = getMPTClient();
        const client2 = initMPTClient({ apiBase: "http://new-api:8080" });

        expect(client1).not.toBe(client2);
        expect(getMPTClient()).toBe(client2);
    });
});

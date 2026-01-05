// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Mock MPT Daemon for Frontend Integration Tests
// Provides realistic API responses matching the actual mptd daemon

import { vi } from "vitest";

// ============================================================================
// Types matching the real daemon
// ============================================================================

export interface MockSession {
    id: string;
    name: string;
    status: "connecting" | "connected" | "disconnected" | "error";
    connection_type: string;
    region?: string;
    hostname?: string;
    created_at: string;
    last_activity: string;
    environment?: {
        SITEOPS_TOOLS: boolean;
        PATH_INCLUDES_SITEOPS: boolean;
    };
}

export interface MockExecutionResult {
    request_id: string;
    session_id: string;
    command: string;
    status: "completed" | "error" | "timeout";
    exit_code: number;
    output: string;
    execution_time_ms: number;
}

export interface MockOutputLine {
    timestamp: string;
    content: string;
}

// ============================================================================
// Mock Daemon State
// ============================================================================

export class MockDaemon {
    private sessions: Map<string, MockSession> = new Map();
    private outputs: Map<string, MockOutputLine[]> = new Map();
    private executions: Map<string, MockExecutionResult> = new Map();
    private sessionCounter = 0;
    private requestCounter = 0;
    private startTime = Date.now();

    reset(): void {
        this.sessions.clear();
        this.outputs.clear();
        this.executions.clear();
        this.sessionCounter = 0;
        this.requestCounter = 0;
    }

    // -------------------------------------------------------------------------
    // API Response Generators
    // -------------------------------------------------------------------------

    health() {
        return {
            status: "healthy",
            version: "1.0.0",
            uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
        };
    }

    status() {
        const activeSessions = Array.from(this.sessions.values()).filter(
            (s) => s.status === "connected"
        ).length;
        return this.wrapResponse({
            sessions: {
                active: activeSessions,
                total_created: this.sessionCounter,
            },
            api: {
                requests_today: this.requestCounter,
                avg_response_time_ms: 50,
            },
        });
    }

    listSessions() {
        return this.wrapResponse({
            sessions: Array.from(this.sessions.values()),
            total: this.sessions.size,
        });
    }

    createSession(name: string, connectionType: string, region?: string): MockSession {
        this.sessionCounter++;
        const id = `sess_${Date.now()}_${this.sessionCounter}`;
        const now = new Date().toISOString();

        const session: MockSession = {
            id,
            name,
            status: "connecting",
            connection_type: connectionType,
            region,
            created_at: now,
            last_activity: now,
        };

        this.sessions.set(id, session);
        this.outputs.set(id, []);

        // Simulate connection after delay
        setTimeout(() => {
            const sess = this.sessions.get(id);
            if (sess && sess.status === "connecting") {
                sess.status = "connected";
                sess.hostname = `devvm${this.sessionCounter}.${region || "prn"}`;
                sess.environment = {
                    SITEOPS_TOOLS: true,
                    PATH_INCLUDES_SITEOPS: true,
                };
                this.addOutput(id, `Connected to ${sess.hostname}`);
            }
        }, 100);

        return session;
    }

    getSession(id: string): MockSession | null {
        return this.sessions.get(id) || null;
    }

    deleteSession(id: string): boolean {
        if (this.sessions.has(id)) {
            this.sessions.delete(id);
            this.outputs.delete(id);
            return true;
        }
        return false;
    }

    reconnectSession(id: string): boolean {
        const session = this.sessions.get(id);
        if (session) {
            session.status = "connecting";
            setTimeout(() => {
                const sess = this.sessions.get(id);
                if (sess) {
                    sess.status = "connected";
                    sess.last_activity = new Date().toISOString();
                }
            }, 100);
            return true;
        }
        return false;
    }

    execute(sessionId: string, command: string): MockExecutionResult | null {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== "connected") {
            return null;
        }

        this.requestCounter++;
        const requestId = `exec_${Date.now()}_${this.requestCounter}`;

        // Simulate command output
        let output = "";
        let exitCode = 0;

        if (command.startsWith("echo ")) {
            output = command.substring(5);
        } else if (command === "pwd") {
            output = "/home/user";
        } else if (command === "whoami") {
            output = "siteops";
        } else if (command.startsWith("hostory ")) {
            output = `Host: ${command.substring(8)}\nStatus: healthy\nUptime: 45 days`;
        } else if (command === "ls") {
            output = "Documents\nDownloads\nProjects";
        } else if (command.includes("invalid")) {
            output = "command not found";
            exitCode = 127;
        } else {
            output = `Executed: ${command}`;
        }

        const result: MockExecutionResult = {
            request_id: requestId,
            session_id: sessionId,
            command,
            status: exitCode === 0 ? "completed" : "error",
            exit_code: exitCode,
            output,
            execution_time_ms: Math.floor(Math.random() * 100) + 10,
        };

        this.executions.set(requestId, result);
        this.addOutput(sessionId, `$ ${command}`);
        this.addOutput(sessionId, output);

        session.last_activity = new Date().toISOString();

        return result;
    }

    getOutput(sessionId: string, lines = 1000) {
        const output = this.outputs.get(sessionId) || [];
        const start = Math.max(0, output.length - lines);
        return this.wrapResponse({
            session_id: sessionId,
            lines: output.slice(start),
            total_lines: output.length,
        });
    }

    searchOutput(sessionId: string, pattern: string) {
        const output = this.outputs.get(sessionId) || [];
        const regex = new RegExp(pattern, "i");
        const matches = output.filter((line) => regex.test(line.content));
        return this.wrapResponse(matches);
    }

    // -------------------------------------------------------------------------
    // Helper Methods
    // -------------------------------------------------------------------------

    private addOutput(sessionId: string, content: string): void {
        const output = this.outputs.get(sessionId);
        if (output) {
            output.push({
                timestamp: new Date().toISOString(),
                content,
            });
        }
    }

    private wrapResponse<T>(data: T) {
        this.requestCounter++;
        return {
            success: true,
            data,
            metadata: {
                request_id: `req_${Date.now()}_${this.requestCounter}`,
                timestamp: new Date().toISOString(),
            },
        };
    }

    wrapError(code: string, message: string) {
        return {
            success: false,
            error: { code, message },
            metadata: {
                request_id: `req_${Date.now()}`,
                timestamp: new Date().toISOString(),
            },
        };
    }
}

// ============================================================================
// Mock Fetch Setup
// ============================================================================

export function createMockFetch(daemon: MockDaemon) {
    return vi.fn(async (url: string, options?: RequestInit) => {
        const method = options?.method || "GET";
        const body = options?.body ? JSON.parse(options.body as string) : null;

        // Parse URL
        const urlObj = new URL(url, "http://localhost:9876");
        const path = urlObj.pathname;

        // Route requests
        let responseData: unknown;
        let status = 200;

        // Health (no auth required)
        if (path === "/api/v1/health" && method === "GET") {
            responseData = daemon.health();
        }
        // Status
        else if (path === "/api/v1/status" && method === "GET") {
            responseData = daemon.status();
        }
        // List sessions
        else if (path === "/api/v1/sessions" && method === "GET") {
            responseData = daemon.listSessions();
        }
        // Create session
        else if (path === "/api/v1/sessions" && method === "POST") {
            const session = daemon.createSession(
                body.name,
                body.connection_type,
                body.region
            );
            responseData = { success: true, data: session };
            status = 201;
        }
        // Get session
        else if (path.match(/^\/api\/v1\/sessions\/[\w_]+$/) && method === "GET") {
            const id = path.split("/").pop()!;
            const session = daemon.getSession(id);
            if (session) {
                responseData = { success: true, data: session };
            } else {
                responseData = daemon.wrapError("NOT_FOUND", "Session not found");
                status = 404;
            }
        }
        // Delete session
        else if (path.match(/^\/api\/v1\/sessions\/[\w_]+$/) && method === "DELETE") {
            const id = path.split("/").pop()!;
            if (daemon.deleteSession(id)) {
                responseData = { success: true, data: { id, status: "closed" } };
            } else {
                responseData = daemon.wrapError("NOT_FOUND", "Session not found");
                status = 404;
            }
        }
        // Reconnect session
        else if (path.match(/^\/api\/v1\/sessions\/[\w_]+\/reconnect$/) && method === "POST") {
            const id = path.split("/")[4];
            if (daemon.reconnectSession(id)) {
                responseData = { success: true, data: { id, status: "reconnecting" } };
            } else {
                responseData = daemon.wrapError("NOT_FOUND", "Session not found");
                status = 404;
            }
        }
        // Execute command
        else if (path === "/api/v1/execute" && method === "POST") {
            const result = daemon.execute(body.session_id, body.command);
            if (result) {
                responseData = { success: true, data: result };
            } else {
                responseData = daemon.wrapError("EXECUTE_FAILED", "Session not connected");
                status = 400;
            }
        }
        // Get output
        else if (path.match(/^\/api\/v1\/output\/[\w_]+$/) && method === "GET") {
            const sessionId = path.split("/").pop()!;
            const lines = parseInt(urlObj.searchParams.get("lines") || "1000");
            responseData = daemon.getOutput(sessionId, lines);
        }
        // Search output
        else if (path.match(/^\/api\/v1\/output\/[\w_]+\/search$/) && method === "GET") {
            const sessionId = path.split("/")[4];
            const pattern = urlObj.searchParams.get("pattern") || "";
            responseData = daemon.searchOutput(sessionId, pattern);
        }
        // Not found
        else {
            responseData = daemon.wrapError("NOT_FOUND", "Endpoint not found");
            status = 404;
        }

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => responseData,
        };
    });
}

// ============================================================================
// Mock WebSocket
// ============================================================================

export class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    url: string;

    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;

    private daemon: MockDaemon;
    private subscriptions: Set<string> = new Set();
    private outputIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

    constructor(url: string, daemon: MockDaemon) {
        this.url = url;
        this.daemon = daemon;

        // Simulate connection delay
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) {
                this.onopen(new Event("open"));
            }
        }, 50);
    }

    send(data: string): void {
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }

        const message = JSON.parse(data);
        this.handleMessage(message);
    }

    close(code?: number, reason?: string): void {
        this.readyState = MockWebSocket.CLOSED;

        // Clear all intervals
        this.outputIntervals.forEach((interval) => clearInterval(interval));
        this.outputIntervals.clear();

        if (this.onclose) {
            this.onclose({
                wasClean: true,
                code: code || 1000,
                reason: reason || "",
            } as CloseEvent);
        }
    }

    private handleMessage(message: { type: string; [key: string]: unknown }): void {
        switch (message.type) {
            case "auth":
                this.sendResponse({ type: "auth:success" });
                break;

            case "subscribe:session":
                this.subscribeToSession(message.session_id as string);
                break;

            case "unsubscribe:session":
                this.unsubscribeFromSession(message.session_id as string);
                break;

            case "execute:command":
                this.executeCommand(
                    message.session_id as string,
                    message.command as string,
                    message.request_id as string
                );
                break;

            default:
                this.sendResponse({
                    type: "error",
                    code: "UNKNOWN_MESSAGE",
                    message: `Unknown message type: ${message.type}`,
                });
        }
    }

    private subscribeToSession(sessionId: string): void {
        this.subscriptions.add(sessionId);

        // Simulate periodic output
        const interval = setInterval(() => {
            const session = this.daemon.getSession(sessionId);
            if (session && session.status === "connected") {
                this.sendResponse({
                    type: "session:output",
                    data: {
                        session_id: sessionId,
                        data: `[${new Date().toISOString()}] heartbeat\n`,
                        timestamp: new Date().toISOString(),
                    },
                });
            }
        }, 5000);

        this.outputIntervals.set(sessionId, interval);
    }

    private unsubscribeFromSession(sessionId: string): void {
        this.subscriptions.delete(sessionId);
        const interval = this.outputIntervals.get(sessionId);
        if (interval) {
            clearInterval(interval);
            this.outputIntervals.delete(sessionId);
        }
    }

    private executeCommand(sessionId: string, command: string, requestId?: string): void {
        const result = this.daemon.execute(sessionId, command);

        if (result) {
            // Send output event
            this.sendResponse({
                type: "session:output",
                data: {
                    session_id: sessionId,
                    data: result.output,
                    timestamp: new Date().toISOString(),
                },
            });

            // Send completion event
            this.sendResponse({
                type: "command:complete",
                data: {
                    request_id: requestId || result.request_id,
                    session_id: sessionId,
                    exit_code: result.exit_code,
                    output: result.output,
                },
            });
        } else {
            this.sendResponse({
                type: "error",
                code: "EXECUTE_FAILED",
                message: "Session not connected",
            });
        }
    }

    private sendResponse(data: unknown): void {
        if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
            this.onmessage({
                data: JSON.stringify(data),
            } as MessageEvent);
        }
    }
}

// ============================================================================
// Test Utilities
// ============================================================================

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTestSession(daemon: MockDaemon, name = "Test Session", region = "prn") {
    return daemon.createSession(name, "od-shellserver", region);
}

// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Test Fixtures for MPT Components
// Common test data and scenario setups for consistent testing

import type { SessionEntry } from "../store/session-store";
import type { Session, ExecutionResult, OutputLine } from "../api/mpt-api";

// ============================================================================
// Session Fixtures
// ============================================================================

/**
 * Pre-defined session IDs for consistent testing
 */
export const SESSION_IDS = {
    PRN_MAIN: "sess_prn_001",
    FRC_BACKUP: "sess_frc_001",
    LCO_DEBUG: "sess_lco_001",
    ALB_PROD: "sess_alb_001",
    DISCONNECTED: "sess_disconnected_001",
    ERROR: "sess_error_001",
};

/**
 * Connected PRN session (raw Session object)
 */
export const RAW_SESSION_PRN: Session = {
    id: SESSION_IDS.PRN_MAIN,
    name: "PRN ShellServer",
    status: "connected",
    connection_type: "od-shellserver",
    region: "prn",
    hostname: "devvm001.prn",
    created_at: "2025-01-05T10:00:00Z",
    last_activity: "2025-01-05T12:00:00Z",
    environment: {
        SITEOPS_TOOLS: true,
        PATH_INCLUDES_SITEOPS: true,
    },
};

/**
 * Connected PRN session fixture (SessionEntry with nested session)
 */
export const SESSION_PRN_CONNECTED: SessionEntry = {
    session: RAW_SESSION_PRN,
    output: [],
    lastActivity: "2025-01-05T12:00:00Z",
    isActive: false,
};

/**
 * Connected FRC session (raw Session object)
 */
export const RAW_SESSION_FRC: Session = {
    id: SESSION_IDS.FRC_BACKUP,
    name: "FRC ShellServer",
    status: "connected",
    connection_type: "od-shellserver",
    region: "frc",
    hostname: "devvm002.frc",
    created_at: "2025-01-05T10:30:00Z",
    last_activity: "2025-01-05T11:45:00Z",
    environment: {
        SITEOPS_TOOLS: true,
        PATH_INCLUDES_SITEOPS: true,
    },
};

/**
 * Connected FRC session fixture
 */
export const SESSION_FRC_CONNECTED: SessionEntry = {
    session: RAW_SESSION_FRC,
    output: [],
    lastActivity: "2025-01-05T11:45:00Z",
    isActive: false,
};

/**
 * Connecting session fixture
 */
export const SESSION_CONNECTING: SessionEntry = {
    session: {
        id: "sess_test_connecting",
        name: "Connecting Session",
        status: "connecting",
        connection_type: "od-shellserver",
        region: "lco",
        created_at: "2025-01-05T12:00:00Z",
        last_activity: "2025-01-05T12:00:00Z",
    },
    output: [],
    lastActivity: "2025-01-05T12:00:00Z",
    isActive: false,
};

/**
 * Disconnected session fixture
 */
export const SESSION_DISCONNECTED: SessionEntry = {
    session: {
        id: SESSION_IDS.DISCONNECTED,
        name: "Disconnected Session",
        status: "disconnected",
        connection_type: "od-shellserver",
        region: "alb",
        created_at: "2025-01-04T08:00:00Z",
        last_activity: "2025-01-04T10:00:00Z",
    },
    output: [],
    lastActivity: "2025-01-04T10:00:00Z",
    isActive: false,
};

/**
 * Error session fixture
 */
export const SESSION_ERROR: SessionEntry = {
    session: {
        id: SESSION_IDS.ERROR,
        name: "Error Session",
        status: "error",
        connection_type: "od-shellserver",
        region: "ftw",
        created_at: "2025-01-05T09:00:00Z",
        last_activity: "2025-01-05T09:05:00Z",
    },
    output: ["Connection failed: timeout"],
    lastActivity: "2025-01-05T09:05:00Z",
    isActive: false,
};

/**
 * Session with output history
 */
export const SESSION_WITH_OUTPUT: SessionEntry = {
    session: {
        ...RAW_SESSION_PRN,
        id: "sess_test_with_output",
        name: "Session with Output",
    },
    output: [
        "$ whoami",
        "siteops",
        "$ pwd",
        "/home/user",
        "$ ls -la",
        "total 32",
        "drwxr-xr-x  5 user user 4096 Jan  5 10:00 .",
        "drwxr-xr-x 10 root root 4096 Jan  1 00:00 ..",
        "-rw-r--r--  1 user user  220 Jan  1 00:00 .bash_logout",
        "-rw-r--r--  1 user user 3771 Jan  1 00:00 .bashrc",
    ],
    lastActivity: "2025-01-05T12:00:00Z",
    isActive: false,
};

// ============================================================================
// Session Collections
// ============================================================================

/**
 * Empty sessions map
 */
export const EMPTY_SESSIONS_MAP = new Map<string, SessionEntry>();

/**
 * Single session map
 */
export const SINGLE_SESSION_MAP = new Map<string, SessionEntry>([
    [SESSION_PRN_CONNECTED.session.id, SESSION_PRN_CONNECTED],
]);

/**
 * Multiple sessions map
 */
export const MULTI_SESSION_MAP = new Map<string, SessionEntry>([
    [SESSION_PRN_CONNECTED.session.id, SESSION_PRN_CONNECTED],
    [SESSION_FRC_CONNECTED.session.id, SESSION_FRC_CONNECTED],
    [SESSION_DISCONNECTED.session.id, SESSION_DISCONNECTED],
]);

/**
 * All regions sessions map
 */
export const MULTI_REGION_MAP = new Map<string, SessionEntry>([
    [SESSION_PRN_CONNECTED.session.id, SESSION_PRN_CONNECTED],
    [SESSION_FRC_CONNECTED.session.id, SESSION_FRC_CONNECTED],
]);

/**
 * All regions sessions map
 */
export const ALL_REGIONS_MAP = new Map<string, SessionEntry>([
    [SESSION_PRN_CONNECTED.session.id, SESSION_PRN_CONNECTED],
    [SESSION_FRC_CONNECTED.session.id, SESSION_FRC_CONNECTED],
    [
        SESSION_IDS.LCO_DEBUG,
        {
            session: {
                ...RAW_SESSION_PRN,
                id: SESSION_IDS.LCO_DEBUG,
                name: "LCO Debug",
                region: "lco",
                hostname: "devvm003.lco",
            },
            output: [],
            lastActivity: new Date().toISOString(),
            isActive: false,
        },
    ],
    [
        SESSION_IDS.ALB_PROD,
        {
            session: {
                ...RAW_SESSION_PRN,
                id: SESSION_IDS.ALB_PROD,
                name: "ALB Production",
                region: "alb",
                hostname: "devvm004.alb",
            },
            output: [],
            lastActivity: new Date().toISOString(),
            isActive: false,
        },
    ],
]);

// ============================================================================
// Execution Result Fixtures
// ============================================================================

/**
 * Successful command execution
 */
export const EXEC_SUCCESS: ExecutionResult = {
    request_id: "exec_test_success",
    session_id: SESSION_IDS.PRN_MAIN,
    command: "whoami",
    status: "completed",
    exit_code: 0,
    output: "siteops",
    execution_time_ms: 50,
};

/**
 * Failed command execution
 */
export const EXEC_FAILED: ExecutionResult = {
    request_id: "exec_test_failed",
    session_id: SESSION_IDS.PRN_MAIN,
    command: "invalid_command",
    status: "error",
    exit_code: 127,
    output: "bash: invalid_command: command not found",
    execution_time_ms: 10,
};

/**
 * Timeout command execution
 */
export const EXEC_TIMEOUT: ExecutionResult = {
    request_id: "exec_test_timeout",
    session_id: SESSION_IDS.PRN_MAIN,
    command: "sleep 300",
    status: "error",
    exit_code: -1,
    output: "Command timed out after 30s",
    execution_time_ms: 30000,
};

/**
 * Long output command execution
 */
export const EXEC_LONG_OUTPUT: ExecutionResult = {
    request_id: "exec_test_long",
    session_id: SESSION_IDS.PRN_MAIN,
    command: "find /var/log -type f",
    status: "completed",
    exit_code: 0,
    output: Array.from({ length: 100 }, (_, i) => `/var/log/file${i}.log`).join("\n"),
    execution_time_ms: 250,
};

// ============================================================================
// Output Line Fixtures
// ============================================================================

/**
 * Basic output lines
 */
export const OUTPUT_LINES_BASIC: OutputLine[] = [
    { timestamp: "2025-01-05T10:00:00Z", content: "$ whoami" },
    { timestamp: "2025-01-05T10:00:01Z", content: "siteops" },
    { timestamp: "2025-01-05T10:00:02Z", content: "$ pwd" },
    { timestamp: "2025-01-05T10:00:03Z", content: "/home/user" },
];

/**
 * Output with errors
 */
export const OUTPUT_LINES_WITH_ERRORS: OutputLine[] = [
    { timestamp: "2025-01-05T10:00:00Z", content: "$ check_service web" },
    { timestamp: "2025-01-05T10:00:01Z", content: "INFO: Checking service status..." },
    { timestamp: "2025-01-05T10:00:02Z", content: "ERROR: Service web is not running" },
    { timestamp: "2025-01-05T10:00:03Z", content: "ERROR: Failed to connect to port 8080" },
    { timestamp: "2025-01-05T10:00:04Z", content: "WARNING: Fallback mode activated" },
];

/**
 * Hostory command output
 */
export const OUTPUT_HOSTORY: OutputLine[] = [
    { timestamp: "2025-01-05T10:00:00Z", content: "$ hostory server001.prn1" },
    { timestamp: "2025-01-05T10:00:01Z", content: "Host: server001.prn1" },
    { timestamp: "2025-01-05T10:00:02Z", content: "Status: healthy" },
    { timestamp: "2025-01-05T10:00:03Z", content: "Uptime: 45 days" },
    { timestamp: "2025-01-05T10:00:04Z", content: "Last reboot: 2024-11-20 03:00:00 UTC" },
    { timestamp: "2025-01-05T10:00:05Z", content: "DC: PRN1" },
    { timestamp: "2025-01-05T10:00:06Z", content: "Rack: A1" },
];

// ============================================================================
// API Response Fixtures
// ============================================================================

/**
 * Health check response
 */
export const API_HEALTH_RESPONSE = {
    status: "healthy",
    version: "1.0.0",
    uptime_seconds: 3600,
};

/**
 * Status response
 */
export const API_STATUS_RESPONSE = {
    sessions: {
        active: 3,
        total_created: 10,
    },
    api: {
        requests_today: 150,
        avg_response_time_ms: 45,
    },
};

/**
 * Sessions list response
 */
export const API_SESSIONS_LIST = {
    sessions: [SESSION_PRN_CONNECTED, SESSION_FRC_CONNECTED],
    total: 2,
};

// ============================================================================
// Quick Connect Presets
// ============================================================================

export const QUICK_CONNECT_PRESETS = [
    {
        id: "od_auto",
        name: "OD Server (Auto)",
        description: "Connect to nearest available OD shell server",
        region: "auto",
    },
    {
        id: "od_prn",
        name: "Prineville (PRN)",
        description: "Oregon, USA",
        region: "prn",
    },
    {
        id: "od_frc",
        name: "Forest City (FRC)",
        description: "North Carolina, USA",
        region: "frc",
    },
    {
        id: "od_lco",
        name: "Lulea (LCO)",
        description: "Sweden",
        region: "lco",
    },
    {
        id: "od_alb",
        name: "Altoona (ALB)",
        description: "Iowa, USA",
        region: "alb",
    },
];

// ============================================================================
// SiteOps Commands
// ============================================================================

export const SITEOPS_COMMANDS = [
    {
        id: "hostory",
        name: "hostory",
        description: "Display host history and status",
        command: "hostory",
        category: "Diagnostics",
        requires_arg: true,
        arg_hint: "hostname",
    },
    {
        id: "dc_status",
        name: "DC Status",
        description: "Show datacenter status overview",
        command: "dc_status",
        category: "Monitoring",
        requires_arg: false,
    },
    {
        id: "check_service",
        name: "Check Service",
        description: "Check service status on host",
        command: "check_service",
        category: "Diagnostics",
        requires_arg: true,
        arg_hint: "service_name",
    },
    {
        id: "tail_logs",
        name: "Tail Logs",
        description: "Tail service logs",
        command: "tail -f /var/log/messages",
        category: "Logs",
        requires_arg: false,
    },
];

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a session entry fixture with custom overrides
 */
export function createSession(sessionOverrides: Partial<Session> = {}): SessionEntry {
    const now = new Date().toISOString();
    const id = sessionOverrides.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
        session: {
            ...RAW_SESSION_PRN,
            id,
            created_at: now,
            last_activity: now,
            ...sessionOverrides,
        },
        output: [],
        lastActivity: now,
        isActive: false,
    };
}

/**
 * Creates multiple session entry fixtures
 */
export function createSessions(count: number, sessionOverrides: Partial<Session> = {}): SessionEntry[] {
    const regions = ["prn", "frc", "lco", "alb", "ftw"];
    return Array.from({ length: count }, (_, i) =>
        createSession({
            name: `Session ${i + 1}`,
            region: regions[i % regions.length],
            hostname: `devvm${String(i + 1).padStart(3, "0")}.${regions[i % regions.length]}`,
            ...sessionOverrides,
        })
    );
}

/**
 * Creates an execution result fixture
 */
export function createExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
    return {
        ...EXEC_SUCCESS,
        request_id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        ...overrides,
    };
}

/**
 * Creates output lines with timestamps
 */
export function createOutputLines(lines: string[]): OutputLine[] {
    const now = new Date();
    return lines.map((content, i) => ({
        timestamp: new Date(now.getTime() + i * 1000).toISOString(),
        content,
    }));
}

/**
 * Creates a sessions map from an array
 */
export function toSessionsMap(sessions: SessionEntry[]): Map<string, SessionEntry> {
    return new Map(sessions.map((s) => [s.session.id, s]));
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Scenario: Fresh install, no sessions
 */
export const SCENARIO_FRESH_INSTALL = {
    sessions: EMPTY_SESSIONS_MAP,
    activeSessionId: null,
    wsStatus: "disconnected" as const,
    isInitialized: false,
};

/**
 * Scenario: Connected with single session
 */
export const SCENARIO_SINGLE_SESSION = {
    sessions: SINGLE_SESSION_MAP,
    activeSessionId: SESSION_PRN_CONNECTED.session.id,
    wsStatus: "connected" as const,
    isInitialized: true,
};

/**
 * Scenario: Multiple active sessions
 */
export const SCENARIO_MULTI_SESSION = {
    sessions: MULTI_SESSION_MAP,
    activeSessionId: SESSION_PRN_CONNECTED.session.id,
    wsStatus: "connected" as const,
    isInitialized: true,
};

/**
 * Scenario: Connection error
 */
export const SCENARIO_CONNECTION_ERROR = {
    sessions: EMPTY_SESSIONS_MAP,
    activeSessionId: null,
    wsStatus: "error" as const,
    isInitialized: true,
    error: "Failed to connect to daemon",
};

/**
 * Scenario: Reconnecting
 */
export const SCENARIO_RECONNECTING = {
    sessions: SINGLE_SESSION_MAP,
    activeSessionId: SESSION_PRN_CONNECTED.session.id,
    wsStatus: "reconnecting" as const,
    isInitialized: true,
};

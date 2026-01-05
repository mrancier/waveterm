// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Test Utilities Index
// Central export for all MPT testing utilities

// ============================================================================
// Mock Daemon Core
// ============================================================================
export {
    MockDaemon,
    createMockFetch,
    MockWebSocket,
    sleep,
    createTestSession,
    type MockSession,
    type MockExecutionResult,
    type MockOutputLine,
} from "./mock-daemon";

// ============================================================================
// React Testing Utilities
// ============================================================================
export {
    // Setup utilities
    setupMockDaemon,
    useMockDaemonSetup,
    createTestStore,
    // Provider component
    TestProvider,
    // Mock factories
    createMockAPIClient,
    createMockWebSocketHandler,
    // Assertion helpers
    waitFor,
    waitForSessionStatus,
    waitForConnection,
    // Data factories
    createSession as createSessionUtil,
    createSessionEntry,
    createSessionsMap,
    createOutputLines,
    // Event simulation
    simulateTyping,
    simulateEnter,
    simulateClick,
    // Console helpers
    suppressConsole,
    // Types
    type MockDaemonContext,
    type TestProviderProps,
    type RenderOptions,
    type RenderResult,
} from "./test-utils";

// ============================================================================
// React Context Provider
// ============================================================================
export {
    // Provider component
    MockDaemonProvider,
    // Hook
    useMockDaemon,
    // HOC
    withMockDaemon,
    // Wrapper factories
    createMockDaemonWrapper,
    // Pre-configured wrappers
    ConnectedMockDaemonWrapper,
    DisconnectedMockDaemonWrapper,
    ErrorMockDaemonWrapper,
    // Types
    type MockDaemonProviderProps,
    type MockDaemonContextValue,
} from "./mock-provider";

// ============================================================================
// Test Fixtures
// ============================================================================
export {
    // Session IDs
    SESSION_IDS,
    // Raw Session objects
    RAW_SESSION_PRN,
    RAW_SESSION_FRC,
    // Individual session fixtures
    SESSION_PRN_CONNECTED,
    SESSION_FRC_CONNECTED,
    SESSION_CONNECTING,
    SESSION_DISCONNECTED,
    SESSION_ERROR,
    SESSION_WITH_OUTPUT,
    // Session collections
    EMPTY_SESSIONS_MAP,
    SINGLE_SESSION_MAP,
    MULTI_SESSION_MAP,
    MULTI_REGION_MAP,
    ALL_REGIONS_MAP,
    // Execution results
    EXEC_SUCCESS,
    EXEC_FAILED,
    EXEC_TIMEOUT,
    EXEC_LONG_OUTPUT,
    // Output lines
    OUTPUT_LINES_BASIC,
    OUTPUT_LINES_WITH_ERRORS,
    OUTPUT_HOSTORY,
    // API responses
    API_HEALTH_RESPONSE,
    API_STATUS_RESPONSE,
    API_SESSIONS_LIST,
    // Presets
    QUICK_CONNECT_PRESETS,
    SITEOPS_COMMANDS,
    // Factory functions
    createSession,
    createSessions,
    createExecutionResult,
    createOutputLines as createOutputLinesWithTimestamps,
    toSessionsMap,
    // Test scenarios
    SCENARIO_FRESH_INSTALL,
    SCENARIO_SINGLE_SESSION,
    SCENARIO_MULTI_SESSION,
    SCENARIO_CONNECTION_ERROR,
    SCENARIO_RECONNECTING,
} from "./test-fixtures";

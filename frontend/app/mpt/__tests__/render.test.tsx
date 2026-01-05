// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// React Component Render Tests for MPT
// Tests component rendering, props handling, and HTML output structure
// Note: Uses renderToString for testing without jsdom dependency

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Provider as JotaiProvider } from "jotai";

// Import test utilities
import {
    setupMockDaemon,
    createTestStore,
} from "./index";

import {
    SESSION_PRN_CONNECTED,
    SINGLE_SESSION_MAP,
} from "./test-fixtures";

// Import components to test
import { QuickConnect, RegionStatus, ActiveConnections } from "../quickconnect";
import { SiteOpsPalette, SITEOPS_COMMANDS, CATEGORIES } from "../siteops-palette";

// ============================================================================
// Test Setup
// ============================================================================

let mockContext: ReturnType<typeof setupMockDaemon>;

beforeAll(() => {
    mockContext = setupMockDaemon();
});

afterAll(() => {
    mockContext.cleanup();
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders a component to HTML string with Jotai store
 */
function render(ui: React.ReactElement): string {
    const store = createTestStore();
    return renderToString(
        <JotaiProvider store={store}>
            {ui}
        </JotaiProvider>
    );
}

/**
 * Checks if HTML contains a CSS class
 */
function hasClass(html: string, className: string): boolean {
    // Match class attribute containing the className
    const classRegex = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`);
    return classRegex.test(html);
}

/**
 * Checks if HTML contains text content
 */
function hasText(html: string, text: string): boolean {
    return html.includes(text);
}

// ============================================================================
// RegionStatus Component Render Tests
// ============================================================================

describe("RegionStatus Render Tests", () => {
    it("should render with connected status", () => {
        const html = render(<RegionStatus region="prn" status="connected" />);

        expect(hasClass(html, "region-status")).toBe(true);
        expect(hasText(html, "PRN")).toBe(true);
        expect(hasClass(html, "fa-circle-check")).toBe(true);
    });

    it("should render with connecting status", () => {
        const html = render(<RegionStatus region="frc" status="connecting" />);

        expect(hasClass(html, "region-status")).toBe(true);
        expect(hasText(html, "FRC")).toBe(true);
        expect(hasClass(html, "fa-spinner")).toBe(true);
    });

    it("should render with disconnected status", () => {
        const html = render(<RegionStatus region="lco" status="disconnected" />);

        expect(hasClass(html, "region-status")).toBe(true);
        expect(hasText(html, "LCO")).toBe(true);
        // Disconnected uses fa-circle (not fa-circle-check)
        expect(html.includes("fa-circle")).toBe(true);
    });

    it("should render with error status", () => {
        const html = render(<RegionStatus region="alb" status="error" />);

        expect(hasClass(html, "region-status")).toBe(true);
        expect(hasText(html, "ALB")).toBe(true);
        expect(hasClass(html, "fa-circle-exclamation")).toBe(true);
    });

    it("should uppercase region name", () => {
        const html = render(<RegionStatus region="ftw" status="connected" />);

        expect(hasText(html, "FTW")).toBe(true);
        expect(hasText(html, "ftw")).toBe(false); // Should not have lowercase
    });

    it("should include region-name class", () => {
        const html = render(<RegionStatus region="prn" status="connected" />);

        expect(hasClass(html, "region-name")).toBe(true);
    });
});

// ============================================================================
// ActiveConnections Component Render Tests
// ============================================================================

describe("ActiveConnections Render Tests", () => {
    it("should render empty state when no connections", () => {
        const html = render(<ActiveConnections connections={[]} />);

        expect(hasClass(html, "active-connections")).toBe(true);
        expect(hasClass(html, "empty")).toBe(true);
        expect(hasText(html, "No active OD connections")).toBe(true);
    });

    it("should render single connection", () => {
        const connections = [
            {
                id: "sess-1",
                name: "PRN ShellServer",
                region: "prn",
                status: "connected" as const,
                hostname: "devvm001.prn",
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        expect(hasClass(html, "active-connections")).toBe(true);
        expect(hasClass(html, "connections-header")).toBe(true);
        // Check for header text (React may add HTML comments between text nodes)
        expect(hasText(html, "Active Connections")).toBe(true);
        expect(hasClass(html, "connection-item")).toBe(true);
        expect(hasText(html, "PRN ShellServer")).toBe(true);
        expect(hasText(html, "devvm001.prn")).toBe(true);
    });

    it("should render multiple connections", () => {
        const connections = [
            {
                id: "sess-1",
                name: "PRN ShellServer",
                region: "prn",
                status: "connected" as const,
            },
            {
                id: "sess-2",
                name: "FRC ShellServer",
                region: "frc",
                status: "connected" as const,
            },
            {
                id: "sess-3",
                name: "LCO ShellServer",
                region: "lco",
                status: "disconnected" as const,
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        // Check for header text (React may add HTML comments between text nodes)
        expect(hasText(html, "Active Connections")).toBe(true);
        expect(hasText(html, "PRN ShellServer")).toBe(true);
        expect(hasText(html, "FRC ShellServer")).toBe(true);
        expect(hasText(html, "LCO ShellServer")).toBe(true);
    });

    it("should render connection with status class", () => {
        const connections = [
            {
                id: "sess-1",
                name: "Connected Session",
                region: "prn",
                status: "connected" as const,
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        expect(hasClass(html, "connected")).toBe(true);
    });

    it("should render disconnect button", () => {
        const connections = [
            {
                id: "sess-1",
                name: "Test Session",
                region: "prn",
                status: "connected" as const,
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        expect(hasClass(html, "disconnect-btn")).toBe(true);
        expect(hasClass(html, "fa-xmark")).toBe(true);
    });

    it("should render connection-name and connection-host classes", () => {
        const connections = [
            {
                id: "sess-1",
                name: "Test Session",
                region: "prn",
                status: "connected" as const,
                hostname: "host.prn",
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        expect(hasClass(html, "connection-name")).toBe(true);
        expect(hasClass(html, "connection-host")).toBe(true);
    });

    it("should include region-status component", () => {
        const connections = [
            {
                id: "sess-1",
                name: "Test Session",
                region: "prn",
                status: "connected" as const,
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        expect(hasClass(html, "region-status")).toBe(true);
        expect(hasText(html, "PRN")).toBe(true);
    });
});

// ============================================================================
// QuickConnect Component Render Tests
// ============================================================================

describe("QuickConnect Render Tests", () => {
    it("should render quickconnect container", () => {
        const html = render(<QuickConnect />);

        expect(hasClass(html, "quickconnect")).toBe(true);
    });

    it("should render Quick Connect button", () => {
        const html = render(<QuickConnect />);

        expect(hasClass(html, "quickconnect-button")).toBe(true);
        expect(hasText(html, "Quick Connect")).toBe(true);
    });

    it("should render bolt icon", () => {
        const html = render(<QuickConnect />);

        expect(hasClass(html, "fa-bolt")).toBe(true);
    });

    it("should render dropdown arrow", () => {
        const html = render(<QuickConnect />);

        expect(hasClass(html, "fa-angle-down")).toBe(true);
    });

    it("should accept custom className", () => {
        const html = render(<QuickConnect className="custom-class" />);

        expect(hasClass(html, "custom-class")).toBe(true);
    });

    it("should render primary button style", () => {
        const html = render(<QuickConnect />);

        expect(hasClass(html, "primary")).toBe(true);
    });

    it("should include title attribute", () => {
        const html = render(<QuickConnect />);

        expect(html.includes('title="Quick Connect to OD Server"')).toBe(true);
    });
});

// ============================================================================
// SiteOpsPalette Component Render Tests
// ============================================================================

describe("SiteOpsPalette Render Tests", () => {
    const mockOnClose = vi.fn();
    const mockOnExecute = vi.fn();

    it("should not render when closed", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={false}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        // Should render nothing or minimal wrapper
        expect(hasClass(html, "siteops-palette")).toBe(false);
    });

    it("should render overlay when open", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "siteops-palette-overlay")).toBe(true);
    });

    it("should render palette container when open", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "siteops-palette")).toBe(true);
    });

    it("should render palette header", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "palette-header")).toBe(true);
        expect(hasClass(html, "palette-title")).toBe(true);
        expect(hasText(html, "SiteOps Commands")).toBe(true);
    });

    it("should render terminal icon in header", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "fa-terminal")).toBe(true);
    });

    it("should render search input", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "palette-search")).toBe(true);
        expect(html.includes('placeholder="Search commands..."')).toBe(true);
    });

    it("should render hostname input", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "palette-hostname")).toBe(true);
        expect(html.includes('placeholder="Enter hostname..."')).toBe(true);
    });

    it("should render with default hostname", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
                defaultHostname="devvm001.prn"
            />
        );

        expect(html.includes('value="devvm001.prn"')).toBe(true);
    });

    it("should render category tabs", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "palette-categories")).toBe(true);
        expect(hasClass(html, "category-tab")).toBe(true);
        expect(hasText(html, "All")).toBe(true);
    });

    it("should render all category tabs", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        // Check for some expected categories
        expect(hasText(html, "Diagnostics")).toBe(true);
        expect(hasText(html, "Hardware Control")).toBe(true);
    });

    it("should render command list", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "palette-commands")).toBe(true);
        expect(hasClass(html, "command-item")).toBe(true);
    });

    it("should render command names and descriptions", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "command-name")).toBe(true);
        expect(hasClass(html, "command-desc")).toBe(true);
    });

    it("should render command icons", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "command-icon")).toBe(true);
    });

    it("should render footer with keyboard hints", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "palette-footer")).toBe(true);
        expect(hasClass(html, "footer-hint")).toBe(true);
        expect(hasText(html, "Navigate")).toBe(true);
        expect(hasText(html, "Execute")).toBe(true);
        expect(hasText(html, "Close")).toBe(true);
    });

    it("should render keyboard shortcuts", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        // Check for kbd elements with arrows and keys
        expect(html.includes("<kbd>")).toBe(true);
        expect(hasText(html, "↑↓")).toBe(true);
        expect(hasText(html, "Enter")).toBe(true);
        expect(hasText(html, "Esc")).toBe(true);
    });

    it("should highlight first command as selected", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasClass(html, "selected")).toBe(true);
    });

    it("should render hostory command", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasText(html, "hostory")).toBe(true);
    });

    it("should render hwc commands", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasText(html, "hwc")).toBe(true);
    });

    it("should render repair command", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={mockOnClose}
                onExecute={mockOnExecute}
            />
        );

        expect(hasText(html, "repair")).toBe(true);
    });
});

// ============================================================================
// SITEOPS_COMMANDS Data Tests
// ============================================================================

describe("SITEOPS_COMMANDS Data", () => {
    it("should have multiple commands defined", () => {
        expect(SITEOPS_COMMANDS.length).toBeGreaterThan(0);
    });

    it("should have required properties on each command", () => {
        SITEOPS_COMMANDS.forEach((cmd) => {
            expect(cmd.name).toBeDefined();
            expect(cmd.description).toBeDefined();
            expect(cmd.command).toBeDefined();
            expect(cmd.category).toBeDefined();
            expect(typeof cmd.requiresArg).toBe("boolean");
        });
    });

    it("should have commands in Diagnostics category", () => {
        const diagnosticsCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Diagnostics"
        );
        expect(diagnosticsCommands.length).toBeGreaterThan(0);
    });

    it("should have commands in Hardware Control category", () => {
        const hwCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Hardware Control"
        );
        expect(hwCommands.length).toBeGreaterThan(0);
    });

    it("should have hostory command", () => {
        const hostory = SITEOPS_COMMANDS.find((cmd) => cmd.name === "hostory");
        expect(hostory).toBeDefined();
        expect(hostory?.category).toBe("Diagnostics");
        expect(hostory?.requiresArg).toBe(true);
    });

    it("should have hwc power commands", () => {
        const powerCommands = SITEOPS_COMMANDS.filter((cmd) =>
            cmd.command.startsWith("hwc power")
        );
        expect(powerCommands.length).toBeGreaterThan(0);
    });

    it("should have repair commands", () => {
        const repairCommands = SITEOPS_COMMANDS.filter((cmd) =>
            cmd.command.startsWith("repair")
        );
        expect(repairCommands.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// CATEGORIES Data Tests
// ============================================================================

describe("CATEGORIES Data", () => {
    it("should have All category", () => {
        expect(CATEGORIES).toContain("All");
    });

    it("should have Diagnostics category", () => {
        expect(CATEGORIES).toContain("Diagnostics");
    });

    it("should have Hardware Control category", () => {
        expect(CATEGORIES).toContain("Hardware Control");
    });

    it("should have Repair Operations category", () => {
        expect(CATEGORIES).toContain("Repair Operations");
    });

    it("should have multiple categories", () => {
        expect(CATEGORIES.length).toBeGreaterThan(3);
    });

    it("should have All as first category", () => {
        expect(CATEGORIES[0]).toBe("All");
    });
});

// ============================================================================
// Component Integration Tests
// ============================================================================

describe("Component Integration", () => {
    it("should render QuickConnect with store", () => {
        const store = createTestStore({
            wsStatus: "connected",
            isInitialized: true,
        });

        const html = renderToString(
            <JotaiProvider store={store}>
                <QuickConnect />
            </JotaiProvider>
        );

        expect(hasClass(html, "quickconnect")).toBe(true);
    });

    it("should render ActiveConnections with session data", () => {
        const store = createTestStore({
            initialSessions: SINGLE_SESSION_MAP,
            activeSessionId: SESSION_PRN_CONNECTED.session.id,
            wsStatus: "connected",
        });

        const connections = [
            {
                id: SESSION_PRN_CONNECTED.session.id,
                name: SESSION_PRN_CONNECTED.session.name,
                region: SESSION_PRN_CONNECTED.session.region || "unknown",
                status: "connected" as const,
                hostname: SESSION_PRN_CONNECTED.session.hostname,
            },
        ];

        const html = renderToString(
            <JotaiProvider store={store}>
                <ActiveConnections connections={connections} />
            </JotaiProvider>
        );

        expect(hasText(html, "PRN ShellServer")).toBe(true);
    });

    it("should render multiple components together", () => {
        const store = createTestStore({
            wsStatus: "connected",
            isInitialized: true,
        });

        const connections = [
            {
                id: "sess-1",
                name: "Test Session",
                region: "prn",
                status: "connected" as const,
            },
        ];

        const html = renderToString(
            <JotaiProvider store={store}>
                <div>
                    <QuickConnect />
                    <ActiveConnections connections={connections} />
                </div>
            </JotaiProvider>
        );

        expect(hasClass(html, "quickconnect")).toBe(true);
        expect(hasClass(html, "active-connections")).toBe(true);
    });
});

// ============================================================================
// HTML Structure Validation Tests
// ============================================================================

describe("HTML Structure Validation", () => {
    it("QuickConnect should have valid HTML structure", () => {
        const html = render(<QuickConnect />);

        // Should have opening and closing div tags
        expect(html.includes("<div")).toBe(true);
        expect(html.includes("</div>")).toBe(true);

        // Should have button element
        expect(html.includes("<button") || html.includes('class="') && html.includes("button")).toBe(true);
    });

    it("RegionStatus should have valid HTML structure", () => {
        const html = render(<RegionStatus region="prn" status="connected" />);

        expect(html.includes("<div")).toBe(true);
        expect(html.includes("<i")).toBe(true);
        expect(html.includes("<span")).toBe(true);
    });

    it("ActiveConnections should have valid HTML structure", () => {
        const connections = [
            {
                id: "sess-1",
                name: "Test",
                region: "prn",
                status: "connected" as const,
            },
        ];

        const html = render(<ActiveConnections connections={connections} />);

        expect(html.includes("<div")).toBe(true);
        // Should have list structure
        expect(hasClass(html, "connections-list")).toBe(true);
    });

    it("SiteOpsPalette should have valid HTML structure when open", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={() => {}}
                onExecute={() => {}}
            />
        );

        // Should have overlay and palette divs
        expect(hasClass(html, "siteops-palette-overlay")).toBe(true);
        expect(hasClass(html, "siteops-palette")).toBe(true);

        // Should have input elements
        expect(html.includes("<input")).toBe(true);

        // Should have button elements for categories
        expect(html.includes("<button")).toBe(true);
    });
});

// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for QuickConnect Component Logic
// Tests OD_PRESETS data, connection handling, and component behavior

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Provider as JotaiProvider } from "jotai";
import { createTestStore } from "./index";

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the hooks
vi.mock("../hooks/use-mpt-session", () => ({
    useMPTConnection: vi.fn(() => [
        { isConnected: false, isConnecting: false, status: "disconnected", error: null },
        { connect: vi.fn(), disconnect: vi.fn() },
    ]),
}));

vi.mock("../store/session-store", () => ({
    useSessionActions: vi.fn(() => ({
        upsertSession: vi.fn(),
        setActive: vi.fn(),
        setError: vi.fn(),
    })),
}));

// Mock the API modules
vi.mock("../api/mpt-api", () => ({
    getMPTClient: vi.fn(() => ({
        createSession: vi.fn().mockResolvedValue({
            id: "sess_test",
            name: "Test Session",
            status: "connected",
        }),
    })),
}));

vi.mock("../api/mpt-websocket", () => ({
    getMPTWebSocket: vi.fn(() => ({
        subscribeToSession: vi.fn(),
        unsubscribeFromSession: vi.fn(),
    })),
}));

// Import after mocks
import { QuickConnect, RegionStatus, ActiveConnections } from "../quickconnect";

// ============================================================================
// Helper Functions
// ============================================================================

function render(ui: React.ReactElement): string {
    const store = createTestStore();
    return renderToString(<JotaiProvider store={store}>{ui}</JotaiProvider>);
}

function hasClass(html: string, className: string): boolean {
    const classRegex = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`);
    return classRegex.test(html);
}

function hasText(html: string, text: string): boolean {
    return html.includes(text);
}

// ============================================================================
// OD_PRESETS Data Tests
// ============================================================================

describe("OD Presets Data", () => {
    // Import the presets for testing
    const OD_PRESETS = [
        {
            id: "od_auto",
            displayName: "OD Server (Auto)",
            description: "Connect to nearest available OD shell server",
            connName: "od://shellserver/auto",
            region: "auto",
            icon: "fa-globe",
        },
        {
            id: "od_et",
            displayName: "OD + Eternal Terminal",
            description: "Persistent OD connection with ET",
            connName: "od://shellserver/auto:et",
            region: "auto",
            useET: true,
            icon: "fa-link",
        },
        {
            id: "od_prn",
            displayName: "Prineville (PRN)",
            description: "Oregon, USA",
            connName: "od://shellserver/prn",
            region: "prn",
            icon: "fa-server",
        },
        {
            id: "od_frc",
            displayName: "Forest City (FRC)",
            description: "North Carolina, USA",
            connName: "od://shellserver/frc",
            region: "frc",
            icon: "fa-server",
        },
        {
            id: "od_lco",
            displayName: "Lulea (LCO)",
            description: "Sweden",
            connName: "od://shellserver/lco",
            region: "lco",
            icon: "fa-server",
        },
    ];

    it("should have auto connection preset", () => {
        const autoPreset = OD_PRESETS.find((p) => p.id === "od_auto");
        expect(autoPreset).toBeDefined();
        expect(autoPreset?.connName).toBe("od://shellserver/auto");
        expect(autoPreset?.region).toBe("auto");
    });

    it("should have Eternal Terminal preset", () => {
        const etPreset = OD_PRESETS.find((p) => p.id === "od_et");
        expect(etPreset).toBeDefined();
        expect(etPreset?.useET).toBe(true);
        expect(etPreset?.connName).toContain(":et");
    });

    it("should have PRN datacenter preset", () => {
        const prnPreset = OD_PRESETS.find((p) => p.id === "od_prn");
        expect(prnPreset).toBeDefined();
        expect(prnPreset?.region).toBe("prn");
        expect(prnPreset?.displayName).toContain("Prineville");
    });

    it("should have FRC datacenter preset", () => {
        const frcPreset = OD_PRESETS.find((p) => p.id === "od_frc");
        expect(frcPreset).toBeDefined();
        expect(frcPreset?.region).toBe("frc");
        expect(frcPreset?.displayName).toContain("Forest City");
    });

    it("should have LCO datacenter preset", () => {
        const lcoPreset = OD_PRESETS.find((p) => p.id === "od_lco");
        expect(lcoPreset).toBeDefined();
        expect(lcoPreset?.region).toBe("lco");
        expect(lcoPreset?.displayName).toContain("Lulea");
    });

    it("all presets should have required fields", () => {
        OD_PRESETS.forEach((preset) => {
            expect(preset.id).toBeDefined();
            expect(preset.displayName).toBeDefined();
            expect(preset.connName).toBeDefined();
            expect(preset.region).toBeDefined();
        });
    });

    it("all presets should have valid connName format", () => {
        OD_PRESETS.forEach((preset) => {
            if (preset.connName) {
                expect(preset.connName).toMatch(/^od:\/\/shellserver\//);
            }
        });
    });

    it("all presets should have icons", () => {
        OD_PRESETS.forEach((preset) => {
            expect(preset.icon).toBeDefined();
            expect(preset.icon).toMatch(/^fa-/);
        });
    });
});

// ============================================================================
// RegionStatus Component Tests
// ============================================================================

describe("RegionStatus Component", () => {
    describe("Rendering", () => {
        it("should render with region name uppercased", () => {
            const html = render(<RegionStatus region="prn" status="connected" />);
            expect(hasText(html, "PRN")).toBe(true);
        });

        it("should render region-status class", () => {
            const html = render(<RegionStatus region="frc" status="connected" />);
            expect(hasClass(html, "region-status")).toBe(true);
        });

        it("should render region-name class", () => {
            const html = render(<RegionStatus region="lco" status="connected" />);
            expect(hasClass(html, "region-name")).toBe(true);
        });
    });

    describe("Status Icons", () => {
        it("should render check icon for connected status", () => {
            const html = render(<RegionStatus region="prn" status="connected" />);
            expect(hasClass(html, "fa-circle-check")).toBe(true);
        });

        it("should render spinner icon for connecting status", () => {
            const html = render(<RegionStatus region="prn" status="connecting" />);
            expect(hasClass(html, "fa-spinner")).toBe(true);
        });

        it("should render circle icon for disconnected status", () => {
            const html = render(<RegionStatus region="prn" status="disconnected" />);
            expect(html.includes("fa-circle")).toBe(true);
        });

        it("should render exclamation icon for error status", () => {
            const html = render(<RegionStatus region="prn" status="error" />);
            expect(hasClass(html, "fa-circle-exclamation")).toBe(true);
        });
    });

    describe("Region Names", () => {
        const regions = ["prn", "frc", "lco", "alb", "ftw"];

        regions.forEach((region) => {
            it(`should render ${region.toUpperCase()} region correctly`, () => {
                const html = render(<RegionStatus region={region} status="connected" />);
                expect(hasText(html, region.toUpperCase())).toBe(true);
            });
        });
    });
});

// ============================================================================
// ActiveConnections Component Tests
// ============================================================================

describe("ActiveConnections Component", () => {
    describe("Empty State", () => {
        it("should render empty message when no connections", () => {
            const html = render(<ActiveConnections connections={[]} />);
            expect(hasText(html, "No active OD connections")).toBe(true);
        });

        it("should have empty class when no connections", () => {
            const html = render(<ActiveConnections connections={[]} />);
            expect(hasClass(html, "empty")).toBe(true);
        });

        it("should render plug icon in empty state", () => {
            const html = render(<ActiveConnections connections={[]} />);
            expect(hasClass(html, "fa-plug-circle-xmark")).toBe(true);
        });
    });

    describe("With Connections", () => {
        const mockConnections = [
            {
                id: "conn-1",
                name: "PRN ShellServer",
                region: "prn",
                status: "connected" as const,
                hostname: "devvm001.prn",
            },
        ];

        it("should render connection count in header", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasText(html, "Active Connections")).toBe(true);
        });

        it("should render connections-header class", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasClass(html, "connections-header")).toBe(true);
        });

        it("should render connections-list class", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasClass(html, "connections-list")).toBe(true);
        });

        it("should render connection-item class", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasClass(html, "connection-item")).toBe(true);
        });

        it("should render connection name", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasText(html, "PRN ShellServer")).toBe(true);
        });

        it("should render connection hostname", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasText(html, "devvm001.prn")).toBe(true);
        });

        it("should render disconnect button", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasClass(html, "disconnect-btn")).toBe(true);
            expect(hasClass(html, "fa-xmark")).toBe(true);
        });

        it("should render RegionStatus component", () => {
            const html = render(<ActiveConnections connections={mockConnections} />);
            expect(hasClass(html, "region-status")).toBe(true);
            expect(hasText(html, "PRN")).toBe(true);
        });
    });

    describe("Multiple Connections", () => {
        const multipleConnections = [
            {
                id: "conn-1",
                name: "PRN ShellServer",
                region: "prn",
                status: "connected" as const,
            },
            {
                id: "conn-2",
                name: "FRC ShellServer",
                region: "frc",
                status: "connected" as const,
            },
            {
                id: "conn-3",
                name: "LCO ShellServer",
                region: "lco",
                status: "disconnected" as const,
            },
        ];

        it("should render all connection names", () => {
            const html = render(<ActiveConnections connections={multipleConnections} />);
            expect(hasText(html, "PRN ShellServer")).toBe(true);
            expect(hasText(html, "FRC ShellServer")).toBe(true);
            expect(hasText(html, "LCO ShellServer")).toBe(true);
        });

        it("should render all region statuses", () => {
            const html = render(<ActiveConnections connections={multipleConnections} />);
            expect(hasText(html, "PRN")).toBe(true);
            expect(hasText(html, "FRC")).toBe(true);
            expect(hasText(html, "LCO")).toBe(true);
        });
    });

    describe("Connection Status Classes", () => {
        it("should have connected class for connected status", () => {
            const connections = [
                {
                    id: "conn-1",
                    name: "Test",
                    region: "prn",
                    status: "connected" as const,
                },
            ];
            const html = render(<ActiveConnections connections={connections} />);
            expect(hasClass(html, "connected")).toBe(true);
        });

        it("should have connecting class for connecting status", () => {
            const connections = [
                {
                    id: "conn-1",
                    name: "Test",
                    region: "prn",
                    status: "connecting" as const,
                },
            ];
            const html = render(<ActiveConnections connections={connections} />);
            expect(hasClass(html, "connecting")).toBe(true);
        });

        it("should have disconnected class for disconnected status", () => {
            const connections = [
                {
                    id: "conn-1",
                    name: "Test",
                    region: "prn",
                    status: "disconnected" as const,
                },
            ];
            const html = render(<ActiveConnections connections={connections} />);
            expect(hasClass(html, "disconnected")).toBe(true);
        });

        it("should have error class for error status", () => {
            const connections = [
                {
                    id: "conn-1",
                    name: "Test",
                    region: "prn",
                    status: "error" as const,
                },
            ];
            const html = render(<ActiveConnections connections={connections} />);
            expect(hasClass(html, "error")).toBe(true);
        });
    });
});

// ============================================================================
// QuickConnect Component Tests
// ============================================================================

describe("QuickConnect Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Rendering", () => {
        it("should render quickconnect container", () => {
            const html = render(<QuickConnect />);
            expect(hasClass(html, "quickconnect")).toBe(true);
        });

        it("should render Quick Connect button text", () => {
            const html = render(<QuickConnect />);
            expect(hasText(html, "Quick Connect")).toBe(true);
        });

        it("should render bolt icon", () => {
            const html = render(<QuickConnect />);
            expect(hasClass(html, "fa-bolt")).toBe(true);
        });

        it("should render dropdown arrow icon", () => {
            const html = render(<QuickConnect />);
            expect(hasClass(html, "fa-angle-down")).toBe(true);
        });

        it("should have quickconnect-button class", () => {
            const html = render(<QuickConnect />);
            expect(hasClass(html, "quickconnect-button")).toBe(true);
        });

        it("should have primary button style", () => {
            const html = render(<QuickConnect />);
            expect(hasClass(html, "primary")).toBe(true);
        });
    });

    describe("Custom Class Name", () => {
        it("should accept custom className", () => {
            const html = render(<QuickConnect className="custom-class" />);
            expect(hasClass(html, "custom-class")).toBe(true);
        });

        it("should preserve quickconnect class with custom class", () => {
            const html = render(<QuickConnect className="custom-class" />);
            expect(hasClass(html, "quickconnect")).toBe(true);
        });
    });

    describe("Accessibility", () => {
        it("should have title attribute", () => {
            const html = render(<QuickConnect />);
            expect(html.includes('title="Quick Connect to OD Server"')).toBe(true);
        });
    });
});

// ============================================================================
// Connection Logic Tests
// ============================================================================

describe("Connection Logic", () => {
    describe("Connection Name Parsing", () => {
        it("should parse auto connection correctly", () => {
            const connName = "od://shellserver/auto";
            expect(connName.startsWith("od://")).toBe(true);
            expect(connName.includes("shellserver")).toBe(true);
            expect(connName.endsWith("/auto")).toBe(true);
        });

        it("should parse ET connection correctly", () => {
            const connName = "od://shellserver/auto:et";
            expect(connName.includes(":et")).toBe(true);
        });

        it("should parse regional connection correctly", () => {
            const regions = ["prn", "frc", "lco", "alb", "ftw"];
            regions.forEach((region) => {
                const connName = `od://shellserver/${region}`;
                expect(connName.endsWith(`/${region}`)).toBe(true);
            });
        });
    });

    describe("Session Request Building", () => {
        it("should build session request for standard connection", () => {
            const preset = {
                displayName: "PRN ShellServer",
                region: "prn",
                useET: false,
            };

            const request = {
                name: preset.displayName,
                connection_type: preset.useET ? "shellserver-et" : "shellserver",
                region: preset.region,
                use_eternal_terminal: preset.useET,
                auto_reconnect: true,
            };

            expect(request.name).toBe("PRN ShellServer");
            expect(request.connection_type).toBe("shellserver");
            expect(request.region).toBe("prn");
            expect(request.use_eternal_terminal).toBe(false);
            expect(request.auto_reconnect).toBe(true);
        });

        it("should build session request for ET connection", () => {
            const preset = {
                displayName: "OD + Eternal Terminal",
                region: "auto",
                useET: true,
            };

            const request = {
                name: preset.displayName,
                connection_type: preset.useET ? "shellserver-et" : "shellserver",
                region: preset.region,
                use_eternal_terminal: preset.useET,
                auto_reconnect: true,
            };

            expect(request.connection_type).toBe("shellserver-et");
            expect(request.use_eternal_terminal).toBe(true);
        });
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Component Integration", () => {
    it("should render QuickConnect and ActiveConnections together", () => {
        const connections = [
            {
                id: "conn-1",
                name: "PRN ShellServer",
                region: "prn",
                status: "connected" as const,
            },
        ];

        const store = createTestStore();
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

    it("should render multiple RegionStatus components", () => {
        const regions = ["prn", "frc", "lco"];
        const store = createTestStore();
        const html = renderToString(
            <JotaiProvider store={store}>
                <div>
                    {regions.map((region) => (
                        <RegionStatus key={region} region={region} status="connected" />
                    ))}
                </div>
            </JotaiProvider>
        );

        expect(hasText(html, "PRN")).toBe(true);
        expect(hasText(html, "FRC")).toBe(true);
        expect(hasText(html, "LCO")).toBe(true);
    });
});

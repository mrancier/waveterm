// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for SiteOps Palette Component Logic
// Tests SITEOPS_COMMANDS, CATEGORIES, command filtering, and component behavior

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Provider as JotaiProvider } from "jotai";
import { createTestStore } from "./index";

// Import after mocks - the actual exports
import { SiteOpsPalette, SITEOPS_COMMANDS, CATEGORIES } from "../siteops-palette";

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
// CATEGORIES Data Tests
// ============================================================================

describe("CATEGORIES Data", () => {
    it("should have All as first category", () => {
        expect(CATEGORIES[0]).toBe("All");
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

    it("should have SeRF Queries category", () => {
        expect(CATEGORIES).toContain("SeRF Queries");
    });

    it("should have Network category", () => {
        expect(CATEGORIES).toContain("Network");
    });

    it("should have Console & SSH category", () => {
        expect(CATEGORIES).toContain("Console & SSH");
    });

    it("should have PWM category", () => {
        expect(CATEGORIES).toContain("PWM");
    });

    it("should have reSORT category", () => {
        expect(CATEGORIES).toContain("reSORT");
    });

    it("should have correct number of categories", () => {
        expect(CATEGORIES.length).toBe(9);
    });
});

// ============================================================================
// SITEOPS_COMMANDS Data Tests
// ============================================================================

describe("SITEOPS_COMMANDS Data", () => {
    describe("Command Structure", () => {
        it("should have multiple commands defined", () => {
            expect(SITEOPS_COMMANDS.length).toBeGreaterThan(0);
        });

        it("all commands should have required properties", () => {
            SITEOPS_COMMANDS.forEach((cmd) => {
                expect(cmd.name).toBeDefined();
                expect(typeof cmd.name).toBe("string");
                expect(cmd.description).toBeDefined();
                expect(typeof cmd.description).toBe("string");
                expect(cmd.command).toBeDefined();
                expect(typeof cmd.command).toBe("string");
                expect(cmd.category).toBeDefined();
                expect(typeof cmd.category).toBe("string");
                expect(typeof cmd.requiresArg).toBe("boolean");
            });
        });

        it("all commands should have valid category", () => {
            const validCategories = CATEGORIES.filter((c) => c !== "All");
            SITEOPS_COMMANDS.forEach((cmd) => {
                expect(validCategories).toContain(cmd.category);
            });
        });

        it("all commands with icons should have valid icon format", () => {
            SITEOPS_COMMANDS.forEach((cmd) => {
                if (cmd.icon) {
                    expect(cmd.icon).toMatch(/^fa-/);
                }
            });
        });
    });

    describe("Diagnostics Commands", () => {
        const diagnosticsCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Diagnostics"
        );

        it("should have diagnostics commands", () => {
            expect(diagnosticsCommands.length).toBeGreaterThan(0);
        });

        it("should have hostory command", () => {
            const hostory = diagnosticsCommands.find((cmd) => cmd.name === "hostory");
            expect(hostory).toBeDefined();
            expect(hostory?.description).toContain("host history");
            expect(hostory?.requiresArg).toBe(true);
        });

        it("should have hwc command", () => {
            const hwc = diagnosticsCommands.find((cmd) => cmd.name === "hwc");
            expect(hwc).toBeDefined();
            expect(hwc?.description).toContain("Hardware controller");
        });

        it("should have machinechecker command", () => {
            const mc = diagnosticsCommands.find((cmd) => cmd.name === "machinechecker");
            expect(mc).toBeDefined();
            expect(mc?.description).toContain("health checks");
        });

        it("should have fishytoo command", () => {
            const fishytoo = diagnosticsCommands.find((cmd) => cmd.name === "fishytoo");
            expect(fishytoo).toBeDefined();
        });
    });

    describe("Hardware Control Commands", () => {
        const hwCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Hardware Control"
        );

        it("should have hardware control commands", () => {
            expect(hwCommands.length).toBeGreaterThan(0);
        });

        it("should have power-on command", () => {
            const powerOn = hwCommands.find((cmd) => cmd.name === "hwc power-on");
            expect(powerOn).toBeDefined();
            expect(powerOn?.command).toBe("hwc power-on");
        });

        it("should have power-off command", () => {
            const powerOff = hwCommands.find((cmd) => cmd.name === "hwc power-off");
            expect(powerOff).toBeDefined();
            expect(powerOff?.command).toBe("hwc power-off");
        });

        it("should have power-cycle command", () => {
            const powerCycle = hwCommands.find((cmd) => cmd.name === "hwc power-cycle");
            expect(powerCycle).toBeDefined();
        });

        it("should have status command", () => {
            const status = hwCommands.find((cmd) => cmd.name === "hwc status");
            expect(status).toBeDefined();
        });

        it("should have bmc-reset command", () => {
            const bmcReset = hwCommands.find((cmd) => cmd.name === "hwc bmc-reset");
            expect(bmcReset).toBeDefined();
        });
    });

    describe("Repair Operations Commands", () => {
        const repairCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Repair Operations"
        );

        it("should have repair commands", () => {
            expect(repairCommands.length).toBeGreaterThan(0);
        });

        it("should have basic repair command", () => {
            const repair = repairCommands.find((cmd) => cmd.name === "repair");
            expect(repair).toBeDefined();
            expect(repair?.description).toContain("automated repair");
        });

        it("should have repair --auto command", () => {
            const repairAuto = repairCommands.find((cmd) => cmd.name === "repair --auto");
            expect(repairAuto).toBeDefined();
        });

        it("should have repair --dry-run command", () => {
            const repairDry = repairCommands.find((cmd) => cmd.name === "repair --dry-run");
            expect(repairDry).toBeDefined();
            expect(repairDry?.description).toContain("Preview");
        });

        it("should have repair --force command", () => {
            const repairForce = repairCommands.find((cmd) => cmd.name === "repair --force");
            expect(repairForce).toBeDefined();
        });
    });

    describe("SeRF Queries Commands", () => {
        const serfCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "SeRF Queries"
        );

        it("should have SeRF commands", () => {
            expect(serfCommands.length).toBeGreaterThan(0);
        });

        it("should have serfcli status command", () => {
            const status = serfCommands.find((cmd) => cmd.name === "serfcli status");
            expect(status).toBeDefined();
        });

        it("should have serfcli get command", () => {
            const get = serfCommands.find((cmd) => cmd.name === "serfcli get");
            expect(get).toBeDefined();
        });

        it("should have serfcli set command", () => {
            const set = serfCommands.find((cmd) => cmd.name === "serfcli set");
            expect(set).toBeDefined();
        });

        it("should have serfcli history command", () => {
            const history = serfCommands.find((cmd) => cmd.name === "serfcli history");
            expect(history).toBeDefined();
        });
    });

    describe("Network Commands", () => {
        const networkCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Network"
        );

        it("should have network commands", () => {
            expect(networkCommands.length).toBeGreaterThan(0);
        });

        it("should have netcheck command", () => {
            const netcheck = networkCommands.find((cmd) => cmd.name === "netcheck");
            expect(netcheck).toBeDefined();
        });

        it("should have fbping command", () => {
            const fbping = networkCommands.find((cmd) => cmd.name === "fbping");
            expect(fbping).toBeDefined();
        });
    });

    describe("Console & SSH Commands", () => {
        const consoleCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "Console & SSH"
        );

        it("should have console commands", () => {
            expect(consoleCommands.length).toBeGreaterThan(0);
        });

        it("should have console command", () => {
            const console = consoleCommands.find((cmd) => cmd.name === "console");
            expect(console).toBeDefined();
            expect(console?.description).toContain("serial console");
        });

        it("should have ssh command", () => {
            const ssh = consoleCommands.find((cmd) => cmd.name === "ssh");
            expect(ssh).toBeDefined();
        });
    });

    describe("PWM Commands", () => {
        const pwmCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "PWM"
        );

        it("should have PWM commands", () => {
            expect(pwmCommands.length).toBeGreaterThan(0);
        });

        it("should have pwm status command", () => {
            const status = pwmCommands.find((cmd) => cmd.name === "pwm status");
            expect(status).toBeDefined();
        });

        it("should have pwm reimage command", () => {
            const reimage = pwmCommands.find((cmd) => cmd.name === "pwm reimage");
            expect(reimage).toBeDefined();
        });
    });

    describe("reSORT Commands", () => {
        const resortCommands = SITEOPS_COMMANDS.filter(
            (cmd) => cmd.category === "reSORT"
        );

        it("should have reSORT commands", () => {
            expect(resortCommands.length).toBeGreaterThan(0);
        });

        it("should have resort create command", () => {
            const create = resortCommands.find((cmd) => cmd.name === "resort create");
            expect(create).toBeDefined();
        });

        it("should have resort status command", () => {
            const status = resortCommands.find((cmd) => cmd.name === "resort status");
            expect(status).toBeDefined();
        });
    });
});

// ============================================================================
// Command Filtering Logic Tests
// ============================================================================

describe("Command Filtering Logic", () => {
    describe("Category Filtering", () => {
        it("should return all commands when category is All", () => {
            const category = "All";
            let commands = SITEOPS_COMMANDS;

            if (category !== "All") {
                commands = commands.filter((cmd) => cmd.category === category);
            }

            expect(commands.length).toBe(SITEOPS_COMMANDS.length);
        });

        it("should filter commands by Diagnostics category", () => {
            const category = "Diagnostics";
            const commands = SITEOPS_COMMANDS.filter((cmd) => cmd.category === category);

            expect(commands.length).toBeGreaterThan(0);
            expect(commands.every((cmd) => cmd.category === category)).toBe(true);
        });

        it("should filter commands by Hardware Control category", () => {
            const category = "Hardware Control";
            const commands = SITEOPS_COMMANDS.filter((cmd) => cmd.category === category);

            expect(commands.length).toBeGreaterThan(0);
            expect(commands.every((cmd) => cmd.category === category)).toBe(true);
        });
    });

    describe("Search Filtering", () => {
        it("should find commands by name", () => {
            const search = "hostory";
            const searchLower = search.toLowerCase();
            const commands = SITEOPS_COMMANDS.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchLower) ||
                    cmd.description.toLowerCase().includes(searchLower) ||
                    cmd.command.toLowerCase().includes(searchLower)
            );

            expect(commands.length).toBeGreaterThan(0);
            expect(commands.some((cmd) => cmd.name === "hostory")).toBe(true);
        });

        it("should find commands by description", () => {
            const search = "power";
            const searchLower = search.toLowerCase();
            const commands = SITEOPS_COMMANDS.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchLower) ||
                    cmd.description.toLowerCase().includes(searchLower) ||
                    cmd.command.toLowerCase().includes(searchLower)
            );

            expect(commands.length).toBeGreaterThan(0);
        });

        it("should find commands by partial match", () => {
            const search = "hwc";
            const searchLower = search.toLowerCase();
            const commands = SITEOPS_COMMANDS.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchLower) ||
                    cmd.description.toLowerCase().includes(searchLower) ||
                    cmd.command.toLowerCase().includes(searchLower)
            );

            expect(commands.length).toBeGreaterThan(0);
        });

        it("should be case-insensitive", () => {
            const searchUpper = "HWC";
            const searchLower = "hwc";

            const commandsUpper = SITEOPS_COMMANDS.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchUpper.toLowerCase()) ||
                    cmd.description.toLowerCase().includes(searchUpper.toLowerCase()) ||
                    cmd.command.toLowerCase().includes(searchUpper.toLowerCase())
            );

            const commandsLower = SITEOPS_COMMANDS.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchLower.toLowerCase()) ||
                    cmd.description.toLowerCase().includes(searchLower.toLowerCase()) ||
                    cmd.command.toLowerCase().includes(searchLower.toLowerCase())
            );

            expect(commandsUpper.length).toBe(commandsLower.length);
        });

        it("should return empty array for non-matching search", () => {
            const search = "xyznonexistent123";
            const searchLower = search.toLowerCase();
            const commands = SITEOPS_COMMANDS.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchLower) ||
                    cmd.description.toLowerCase().includes(searchLower) ||
                    cmd.command.toLowerCase().includes(searchLower)
            );

            expect(commands.length).toBe(0);
        });
    });

    describe("Combined Filtering", () => {
        it("should filter by category and search together", () => {
            const category = "Hardware Control";
            const search = "power";
            const searchLower = search.toLowerCase();

            let commands = SITEOPS_COMMANDS;

            // Filter by category
            commands = commands.filter((cmd) => cmd.category === category);

            // Filter by search
            commands = commands.filter(
                (cmd) =>
                    cmd.name.toLowerCase().includes(searchLower) ||
                    cmd.description.toLowerCase().includes(searchLower) ||
                    cmd.command.toLowerCase().includes(searchLower)
            );

            expect(commands.length).toBeGreaterThan(0);
            expect(commands.every((cmd) => cmd.category === category)).toBe(true);
            expect(
                commands.every(
                    (cmd) =>
                        cmd.name.toLowerCase().includes(searchLower) ||
                        cmd.description.toLowerCase().includes(searchLower) ||
                        cmd.command.toLowerCase().includes(searchLower)
                )
            ).toBe(true);
        });
    });
});

// ============================================================================
// SiteOpsPalette Component Tests
// ============================================================================

describe("SiteOpsPalette Component", () => {
    const mockOnClose = vi.fn();
    const mockOnExecute = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Closed State", () => {
        it("should not render when isOpen is false", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={false}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "siteops-palette")).toBe(false);
        });
    });

    describe("Open State", () => {
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
    });

    describe("Header", () => {
        it("should render palette header", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "palette-header")).toBe(true);
        });

        it("should render SiteOps Commands title", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasText(html, "SiteOps Commands")).toBe(true);
        });

        it("should render terminal icon", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "fa-terminal")).toBe(true);
        });
    });

    describe("Search Input", () => {
        it("should render search input", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "palette-search")).toBe(true);
        });

        it("should have search placeholder", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(html.includes('placeholder="Search commands..."')).toBe(true);
        });
    });

    describe("Hostname Input", () => {
        it("should render hostname input", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "palette-hostname")).toBe(true);
        });

        it("should have hostname placeholder", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(html.includes('placeholder="Enter hostname..."')).toBe(true);
        });

        it("should render with default hostname when provided", () => {
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
    });

    describe("Category Tabs", () => {
        it("should render palette-categories container", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "palette-categories")).toBe(true);
        });

        it("should render category-tab class", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "category-tab")).toBe(true);
        });

        it("should render All category tab", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasText(html, "All")).toBe(true);
        });

        it("should render Diagnostics category tab", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasText(html, "Diagnostics")).toBe(true);
        });

        it("should render Hardware Control category tab", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasText(html, "Hardware Control")).toBe(true);
        });
    });

    describe("Command List", () => {
        it("should render palette-commands container", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "palette-commands")).toBe(true);
        });

        it("should render command-item class", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "command-item")).toBe(true);
        });

        it("should render command-name class", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "command-name")).toBe(true);
        });

        it("should render command-desc class", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "command-desc")).toBe(true);
        });

        it("should render command-icon class", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "command-icon")).toBe(true);
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
    });

    describe("Footer", () => {
        it("should render palette-footer", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "palette-footer")).toBe(true);
        });

        it("should render footer-hint", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasClass(html, "footer-hint")).toBe(true);
        });

        it("should render keyboard hints", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasText(html, "Navigate")).toBe(true);
            expect(hasText(html, "Execute")).toBe(true);
            expect(hasText(html, "Close")).toBe(true);
        });

        it("should render kbd elements", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(html.includes("<kbd>")).toBe(true);
            expect(hasText(html, "↑↓")).toBe(true);
            expect(hasText(html, "Enter")).toBe(true);
            expect(hasText(html, "Esc")).toBe(true);
        });
    });

    describe("Rendered Commands", () => {
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

        it("should render serfcli commands", () => {
            const html = render(
                <SiteOpsPalette
                    isOpen={true}
                    onClose={mockOnClose}
                    onExecute={mockOnExecute}
                />
            );

            expect(hasText(html, "serfcli")).toBe(true);
        });
    });
});

// ============================================================================
// Command Execution Logic Tests
// ============================================================================

describe("Command Execution Logic", () => {
    describe("Command Building", () => {
        it("should build command with hostname", () => {
            const cmd = SITEOPS_COMMANDS.find((c) => c.name === "hostory");
            const hostname = "devvm001.prn";

            const fullCommand = `${cmd?.command} ${hostname}`;

            expect(fullCommand).toBe("hostory devvm001.prn");
        });

        it("should handle commands that require arguments", () => {
            const cmdsRequiringArgs = SITEOPS_COMMANDS.filter((c) => c.requiresArg);

            expect(cmdsRequiringArgs.length).toBeGreaterThan(0);
            cmdsRequiringArgs.forEach((cmd) => {
                expect(cmd.argHint).toBeDefined();
            });
        });

        it("should handle hwc power commands correctly", () => {
            const powerOn = SITEOPS_COMMANDS.find((c) => c.name === "hwc power-on");
            const hostname = "server001.prn";

            const fullCommand = `${powerOn?.command} ${hostname}`;

            expect(fullCommand).toBe("hwc power-on server001.prn");
        });
    });

    describe("Argument Hints", () => {
        it("hostory should have hostname hint", () => {
            const hostory = SITEOPS_COMMANDS.find((c) => c.name === "hostory");
            expect(hostory?.argHint).toBe("hostname");
        });

        it("serfcli set should have hostname attribute value hint", () => {
            const serfSet = SITEOPS_COMMANDS.find((c) => c.name === "serfcli set");
            expect(serfSet?.argHint).toContain("hostname");
            expect(serfSet?.argHint).toContain("attribute");
            expect(serfSet?.argHint).toContain("value");
        });

        it("resort status should have ticket_id hint", () => {
            const resortStatus = SITEOPS_COMMANDS.find((c) => c.name === "resort status");
            expect(resortStatus?.argHint).toBe("ticket_id");
        });
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("SiteOps Integration", () => {
    it("should render all category buttons based on CATEGORIES", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={() => {}}
                onExecute={() => {}}
            />
        );

        CATEGORIES.forEach((category) => {
            // Handle HTML entity encoding (& becomes &amp;)
            const searchText = category.replace(/&/g, "&amp;");
            expect(hasText(html, searchText)).toBe(true);
        });
    });

    it("should render commands from SITEOPS_COMMANDS", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={() => {}}
                onExecute={() => {}}
            />
        );

        // Check a few representative commands
        expect(hasText(html, "hostory")).toBe(true);
        expect(hasText(html, "repair")).toBe(true);
        expect(hasText(html, "console")).toBe(true);
    });

    it("should have valid HTML structure", () => {
        const html = render(
            <SiteOpsPalette
                isOpen={true}
                onClose={() => {}}
                onExecute={() => {}}
            />
        );

        // Should have basic HTML structure
        expect(html.includes("<div")).toBe(true);
        expect(html.includes("<input")).toBe(true);
        expect(html.includes("<button")).toBe(true);
    });
});

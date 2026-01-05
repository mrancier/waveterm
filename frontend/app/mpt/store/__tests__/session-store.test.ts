// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Tests for MPT Session Store
// Tests the Jotai atoms for session state management

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStore } from "jotai";
import {
    // Core atoms
    sessionsMapAtom,
    activeSessionIdAtom,
    wsConnectionStatusAtom,
    lastErrorAtom,
    // Derived atoms
    sessionsListAtom,
    activeSessionAtom,
    activeSessionOutputAtom,
    sessionCountAtom,
    connectedSessionsCountAtom,
    isWsConnectedAtom,
    sessionsByRegionAtom,
    // Action atoms
    upsertSessionAtom,
    removeSessionAtom,
    updateSessionStatusAtom,
    appendSessionOutputAtom,
    clearSessionOutputAtom,
    setActiveSessionAtom,
    setSessionsFromApiAtom,
    setErrorAtom,
    // Preset atoms
    quickConnectPresetsAtom,
    siteOpsCommandsAtom,
    siteOpsCommandsByCategoryAtom,
    // Types
    QuickConnectPreset,
    SiteOpsCommandEntry,
} from "../session-store";
import { Session } from "../../api/mpt-api";

describe("Session Store", () => {
    let store: ReturnType<typeof createStore>;

    // Helper to create a test session
    const createTestSession = (
        id: string,
        overrides: Partial<Session> = {}
    ): Session => ({
        id,
        name: `Session ${id}`,
        status: "connected",
        connection_type: "shellserver",
        region: "prn",
        created_at: "2025-01-05T00:00:00Z",
        last_activity: "2025-01-05T00:00:00Z",
        ...overrides,
    });

    beforeEach(() => {
        store = createStore();
    });

    describe("Core Atoms", () => {
        describe("sessionsMapAtom", () => {
            it("should initialize as empty Map", () => {
                const sessionsMap = store.get(sessionsMapAtom);
                expect(sessionsMap).toBeInstanceOf(Map);
                expect(sessionsMap.size).toBe(0);
            });
        });

        describe("activeSessionIdAtom", () => {
            it("should initialize as null", () => {
                const activeId = store.get(activeSessionIdAtom);
                expect(activeId).toBeNull();
            });
        });

        describe("wsConnectionStatusAtom", () => {
            it("should initialize as disconnected", () => {
                const status = store.get(wsConnectionStatusAtom);
                expect(status).toBe("disconnected");
            });

            it("should update connection status", () => {
                store.set(wsConnectionStatusAtom, "connected");
                expect(store.get(wsConnectionStatusAtom)).toBe("connected");

                store.set(wsConnectionStatusAtom, "reconnecting");
                expect(store.get(wsConnectionStatusAtom)).toBe("reconnecting");
            });
        });

        describe("lastErrorAtom", () => {
            it("should initialize as null", () => {
                const error = store.get(lastErrorAtom);
                expect(error).toBeNull();
            });
        });
    });

    describe("Action Atoms", () => {
        describe("upsertSessionAtom", () => {
            it("should add new session to map", () => {
                const session = createTestSession("s1");

                store.set(upsertSessionAtom, session);

                const sessionsMap = store.get(sessionsMapAtom);
                expect(sessionsMap.size).toBe(1);
                expect(sessionsMap.get("s1")?.session).toEqual(session);
            });

            it("should update existing session", () => {
                const session1 = createTestSession("s1", { status: "connecting" });
                const session2 = createTestSession("s1", { status: "connected" });

                store.set(upsertSessionAtom, session1);
                store.set(upsertSessionAtom, session2);

                const sessionsMap = store.get(sessionsMapAtom);
                expect(sessionsMap.size).toBe(1);
                expect(sessionsMap.get("s1")?.session.status).toBe("connected");
            });

            it("should preserve existing output when updating", () => {
                const session = createTestSession("s1");

                store.set(upsertSessionAtom, session);
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line1" });
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line2" });

                // Update session
                const updatedSession = createTestSession("s1", { status: "reconnecting" });
                store.set(upsertSessionAtom, updatedSession);

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.output).toEqual(["line1", "line2"]);
            });

            it("should set isActive based on activeSessionId", () => {
                store.set(activeSessionIdAtom, "s1");

                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.isActive).toBe(true);
            });
        });

        describe("removeSessionAtom", () => {
            it("should remove session from map", () => {
                const session1 = createTestSession("s1");
                const session2 = createTestSession("s2");

                store.set(upsertSessionAtom, session1);
                store.set(upsertSessionAtom, session2);
                expect(store.get(sessionsMapAtom).size).toBe(2);

                store.set(removeSessionAtom, "s1");

                const sessionsMap = store.get(sessionsMapAtom);
                expect(sessionsMap.size).toBe(1);
                expect(sessionsMap.has("s1")).toBe(false);
                expect(sessionsMap.has("s2")).toBe(true);
            });

            it("should clear activeSessionId if removed session was active", () => {
                const session = createTestSession("s1");

                store.set(upsertSessionAtom, session);
                store.set(activeSessionIdAtom, "s1");

                store.set(removeSessionAtom, "s1");

                expect(store.get(activeSessionIdAtom)).toBeNull();
            });

            it("should not affect activeSessionId if different session was removed", () => {
                const session1 = createTestSession("s1");
                const session2 = createTestSession("s2");

                store.set(upsertSessionAtom, session1);
                store.set(upsertSessionAtom, session2);
                store.set(activeSessionIdAtom, "s1");

                store.set(removeSessionAtom, "s2");

                expect(store.get(activeSessionIdAtom)).toBe("s1");
            });
        });

        describe("updateSessionStatusAtom", () => {
            it("should update session status", () => {
                const session = createTestSession("s1", { status: "connecting" });
                store.set(upsertSessionAtom, session);

                store.set(updateSessionStatusAtom, { sessionId: "s1", status: "connected" });

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.session.status).toBe("connected");
            });

            it("should update lastActivity timestamp", () => {
                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);

                const beforeUpdate = store.get(sessionsMapAtom).get("s1")?.lastActivity;

                // Mock Date to return a different time
                const originalNow = Date.now;
                const originalISOString = Date.prototype.toISOString;
                Date.now = vi.fn(() => originalNow() + 1000); // 1 second later
                Date.prototype.toISOString = vi.fn(() => "2099-01-01T00:00:00.000Z");

                store.set(updateSessionStatusAtom, { sessionId: "s1", status: "disconnected" });

                // Restore Date
                Date.now = originalNow;
                Date.prototype.toISOString = originalISOString;

                const afterUpdate = store.get(sessionsMapAtom).get("s1")?.lastActivity;
                expect(afterUpdate).not.toBe(beforeUpdate);
            });

            it("should do nothing if session does not exist", () => {
                store.set(updateSessionStatusAtom, { sessionId: "nonexistent", status: "connected" });

                expect(store.get(sessionsMapAtom).size).toBe(0);
            });
        });

        describe("appendSessionOutputAtom", () => {
            it("should append output to session", () => {
                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);

                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line1" });
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line2" });
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line3" });

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.output).toEqual(["line1", "line2", "line3"]);
            });

            it("should trim output when exceeding maxLines", () => {
                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);

                // Add more than maxLines (set to 5 for test)
                for (let i = 0; i < 10; i++) {
                    store.set(appendSessionOutputAtom, { sessionId: "s1", data: `line${i}`, maxLines: 5 });
                }

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.output).toHaveLength(5);
                expect(entry?.output[0]).toBe("line5");
                expect(entry?.output[4]).toBe("line9");
            });
        });

        describe("clearSessionOutputAtom", () => {
            it("should clear session output", () => {
                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line1" });
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "line2" });

                store.set(clearSessionOutputAtom, "s1");

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.output).toEqual([]);
            });
        });

        describe("setActiveSessionAtom", () => {
            it("should set active session", () => {
                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);

                store.set(setActiveSessionAtom, "s1");

                expect(store.get(activeSessionIdAtom)).toBe("s1");
                expect(store.get(sessionsMapAtom).get("s1")?.isActive).toBe(true);
            });

            it("should update isActive flags when changing active session", () => {
                const session1 = createTestSession("s1");
                const session2 = createTestSession("s2");
                store.set(upsertSessionAtom, session1);
                store.set(upsertSessionAtom, session2);

                store.set(setActiveSessionAtom, "s1");
                expect(store.get(sessionsMapAtom).get("s1")?.isActive).toBe(true);
                expect(store.get(sessionsMapAtom).get("s2")?.isActive).toBe(false);

                store.set(setActiveSessionAtom, "s2");
                expect(store.get(sessionsMapAtom).get("s1")?.isActive).toBe(false);
                expect(store.get(sessionsMapAtom).get("s2")?.isActive).toBe(true);
            });

            it("should handle setting active to null", () => {
                const session = createTestSession("s1");
                store.set(upsertSessionAtom, session);
                store.set(setActiveSessionAtom, "s1");

                store.set(setActiveSessionAtom, null);

                expect(store.get(activeSessionIdAtom)).toBeNull();
                expect(store.get(sessionsMapAtom).get("s1")?.isActive).toBe(false);
            });
        });

        describe("setSessionsFromApiAtom", () => {
            it("should bulk update sessions", () => {
                const sessions = [
                    createTestSession("s1"),
                    createTestSession("s2"),
                    createTestSession("s3"),
                ];

                store.set(setSessionsFromApiAtom, sessions);

                const sessionsMap = store.get(sessionsMapAtom);
                expect(sessionsMap.size).toBe(3);
                expect(sessionsMap.get("s1")?.session.id).toBe("s1");
                expect(sessionsMap.get("s2")?.session.id).toBe("s2");
                expect(sessionsMap.get("s3")?.session.id).toBe("s3");
            });

            it("should preserve existing output when bulk updating", () => {
                const session1 = createTestSession("s1");
                store.set(upsertSessionAtom, session1);
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "preserved output" });

                const updatedSessions = [
                    createTestSession("s1", { status: "reconnecting" }),
                    createTestSession("s2"),
                ];

                store.set(setSessionsFromApiAtom, updatedSessions);

                const entry = store.get(sessionsMapAtom).get("s1");
                expect(entry?.output).toEqual(["preserved output"]);
            });
        });

        describe("setErrorAtom", () => {
            it("should set error message", () => {
                store.set(setErrorAtom, "Connection failed");
                expect(store.get(lastErrorAtom)).toBe("Connection failed");
            });

            it("should clear error when set to null", () => {
                store.set(setErrorAtom, "Some error");
                store.set(setErrorAtom, null);
                expect(store.get(lastErrorAtom)).toBeNull();
            });
        });
    });

    describe("Derived Atoms", () => {
        describe("sessionsListAtom", () => {
            it("should return sessions as array", () => {
                store.set(upsertSessionAtom, createTestSession("s1"));
                store.set(upsertSessionAtom, createTestSession("s2"));

                const sessionsList = store.get(sessionsListAtom);

                expect(sessionsList).toHaveLength(2);
                expect(sessionsList.map((s) => s.id)).toContain("s1");
                expect(sessionsList.map((s) => s.id)).toContain("s2");
            });

            it("should return empty array when no sessions", () => {
                const sessionsList = store.get(sessionsListAtom);
                expect(sessionsList).toEqual([]);
            });
        });

        describe("activeSessionAtom", () => {
            it("should return active session", () => {
                store.set(upsertSessionAtom, createTestSession("s1"));
                store.set(upsertSessionAtom, createTestSession("s2"));
                store.set(setActiveSessionAtom, "s2");

                const activeSession = store.get(activeSessionAtom);

                expect(activeSession?.id).toBe("s2");
            });

            it("should return null when no active session", () => {
                store.set(upsertSessionAtom, createTestSession("s1"));

                const activeSession = store.get(activeSessionAtom);

                expect(activeSession).toBeNull();
            });
        });

        describe("activeSessionOutputAtom", () => {
            it("should return active session output", () => {
                store.set(upsertSessionAtom, createTestSession("s1"));
                store.set(setActiveSessionAtom, "s1");
                store.set(appendSessionOutputAtom, { sessionId: "s1", data: "output line" });

                const output = store.get(activeSessionOutputAtom);

                expect(output).toEqual(["output line"]);
            });

            it("should return empty array when no active session", () => {
                const output = store.get(activeSessionOutputAtom);
                expect(output).toEqual([]);
            });
        });

        describe("sessionCountAtom", () => {
            it("should return total session count", () => {
                expect(store.get(sessionCountAtom)).toBe(0);

                store.set(upsertSessionAtom, createTestSession("s1"));
                expect(store.get(sessionCountAtom)).toBe(1);

                store.set(upsertSessionAtom, createTestSession("s2"));
                expect(store.get(sessionCountAtom)).toBe(2);

                store.set(removeSessionAtom, "s1");
                expect(store.get(sessionCountAtom)).toBe(1);
            });
        });

        describe("connectedSessionsCountAtom", () => {
            it("should count only connected sessions", () => {
                store.set(upsertSessionAtom, createTestSession("s1", { status: "connected" }));
                store.set(upsertSessionAtom, createTestSession("s2", { status: "disconnected" }));
                store.set(upsertSessionAtom, createTestSession("s3", { status: "connected" }));
                store.set(upsertSessionAtom, createTestSession("s4", { status: "connecting" }));

                const connectedCount = store.get(connectedSessionsCountAtom);

                expect(connectedCount).toBe(2);
            });
        });

        describe("isWsConnectedAtom", () => {
            it("should return true when connected", () => {
                store.set(wsConnectionStatusAtom, "connected");
                expect(store.get(isWsConnectedAtom)).toBe(true);
            });

            it("should return false when not connected", () => {
                store.set(wsConnectionStatusAtom, "disconnected");
                expect(store.get(isWsConnectedAtom)).toBe(false);

                store.set(wsConnectionStatusAtom, "connecting");
                expect(store.get(isWsConnectedAtom)).toBe(false);

                store.set(wsConnectionStatusAtom, "reconnecting");
                expect(store.get(isWsConnectedAtom)).toBe(false);
            });
        });

        describe("sessionsByRegionAtom", () => {
            it("should group sessions by region", () => {
                store.set(upsertSessionAtom, createTestSession("s1", { region: "prn" }));
                store.set(upsertSessionAtom, createTestSession("s2", { region: "frc" }));
                store.set(upsertSessionAtom, createTestSession("s3", { region: "prn" }));
                store.set(upsertSessionAtom, createTestSession("s4", { region: "lco" }));

                const byRegion = store.get(sessionsByRegionAtom);

                expect(byRegion["prn"]).toHaveLength(2);
                expect(byRegion["frc"]).toHaveLength(1);
                expect(byRegion["lco"]).toHaveLength(1);
            });

            it("should use 'unknown' for sessions without region", () => {
                store.set(upsertSessionAtom, createTestSession("s1", { region: undefined }));

                const byRegion = store.get(sessionsByRegionAtom);

                expect(byRegion["unknown"]).toHaveLength(1);
            });
        });
    });

    describe("Preset Atoms", () => {
        describe("quickConnectPresetsAtom", () => {
            it("should have predefined datacenter presets", () => {
                const presets = store.get(quickConnectPresetsAtom);

                expect(presets.length).toBeGreaterThan(0);

                const regions = presets.map((p) => p.region);
                expect(regions).toContain("prn");
                expect(regions).toContain("frc");
                expect(regions).toContain("lco");
                expect(regions).toContain("alb");
                expect(regions).toContain("ftw");
            });

            it("should have required properties for each preset", () => {
                const presets = store.get(quickConnectPresetsAtom);

                presets.forEach((preset) => {
                    expect(preset.id).toBeDefined();
                    expect(preset.name).toBeDefined();
                    expect(preset.region).toBeDefined();
                    expect(preset.connectionType).toBeDefined();
                });
            });
        });

        describe("siteOpsCommandsAtom", () => {
            it("should have predefined SiteOps commands", () => {
                const commands = store.get(siteOpsCommandsAtom);

                expect(commands.length).toBeGreaterThan(0);

                const commandNames = commands.map((c) => c.name);
                expect(commandNames).toContain("hostory");
                expect(commandNames).toContain("hwc");
                expect(commandNames).toContain("machinechecker");
            });

            it("should have required properties for each command", () => {
                const commands = store.get(siteOpsCommandsAtom);

                commands.forEach((cmd) => {
                    expect(cmd.id).toBeDefined();
                    expect(cmd.name).toBeDefined();
                    expect(cmd.command).toBeDefined();
                    expect(cmd.category).toBeDefined();
                    expect(typeof cmd.requiresArg).toBe("boolean");
                });
            });
        });

        describe("siteOpsCommandsByCategoryAtom", () => {
            it("should group commands by category", () => {
                const byCategory = store.get(siteOpsCommandsByCategoryAtom);

                expect(Object.keys(byCategory).length).toBeGreaterThan(0);

                // Each category should have at least one command
                Object.values(byCategory).forEach((commands) => {
                    expect(commands.length).toBeGreaterThan(0);
                });
            });

            it("should have consistent category assignments", () => {
                const byCategory = store.get(siteOpsCommandsByCategoryAtom);
                const allCommands = store.get(siteOpsCommandsAtom);

                // Total commands in byCategory should equal total commands
                const totalInCategories = Object.values(byCategory).reduce(
                    (sum, cmds) => sum + cmds.length,
                    0
                );
                expect(totalInCategories).toBe(allCommands.length);
            });
        });
    });
});

// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Output Parser Service for Meta ProdOps Terminal
// Provides client-side output parsing for SiteOps commands

export interface ParsedOutput {
    command: string;
    rawOutput: string;
    parsedData: unknown;
    metadata: Record<string, unknown>;
    parsedAt: string;
    parserUsed: string;
    parseStatus: "success" | "partial" | "failed";
    errors?: string[];
}

export interface HostoryEvent {
    timestamp: string;
    eventType: string;
    description: string;
    source?: string;
    user?: string;
}

export interface HostoryResult {
    hostname: string;
    events: HostoryEvent[];
    summary: {
        totalEvents: number;
        eventTypes: Record<string, number>;
    };
}

export interface RepairAction {
    name: string;
    status: string;
    startTime?: string;
    endTime?: string;
    result?: string;
}

export interface RepairStatus {
    hostname: string;
    repairState: string;
    repairReason?: string;
    ticketId?: string;
    lastUpdated?: string;
    actions: RepairAction[];
}

export interface SerfAttribute {
    key: string;
    value: string;
    timestamp?: string;
    source?: string;
}

export interface SerfResult {
    hostname: string;
    attributes: SerfAttribute[];
}

export interface HwcLogEntry {
    timestamp: string;
    level: string;
    component?: string;
    message: string;
}

export interface HwcStatus {
    hostname: string;
    powerState?: string;
    bmcStatus?: string;
    lastPowerOn?: string;
    lastPowerOff?: string;
    logEntries: HwcLogEntry[];
    errors: string[];
}

export interface HealthCheck {
    name: string;
    status: string;
    message?: string;
    severity?: string;
}

export interface MachinecheckerResult {
    hostname: string;
    overallStatus: string;
    checks: HealthCheck[];
    score?: number;
}

export interface SearchResult {
    lineNumber: number;
    line: string;
    matchStart: number;
    matchEnd: number;
    context: {
        before: string[];
        after: string[];
    };
}

export type ExportFormat = "json" | "csv" | "markdown" | "raw";

type ParserFunction = (command: string, output: string) => ParsedOutput;

interface ParserEntry {
    name: string;
    pattern: RegExp;
    parser: ParserFunction;
    description: string;
    priority: number;
}

class OutputParserRegistry {
    private parsers: ParserEntry[] = [];
    private fallback: ParserFunction;

    constructor() {
        this.fallback = this.defaultParser.bind(this);
        this.registerBuiltinParsers();
    }

    register(
        name: string,
        pattern: RegExp,
        parser: ParserFunction,
        description: string,
        priority: number
    ): void {
        const entry: ParserEntry = { name, pattern, parser, description, priority };

        // Insert in priority order (higher priority first)
        let inserted = false;
        for (let i = 0; i < this.parsers.length; i++) {
            if (priority > this.parsers[i].priority) {
                this.parsers.splice(i, 0, entry);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.parsers.push(entry);
        }
    }

    unregister(name: string): boolean {
        const idx = this.parsers.findIndex((p) => p.name === name);
        if (idx !== -1) {
            this.parsers.splice(idx, 1);
            return true;
        }
        return false;
    }

    parse(command: string, output: string): ParsedOutput {
        // Try each parser in priority order
        for (const entry of this.parsers) {
            if (entry.pattern.test(command)) {
                try {
                    const result = entry.parser(command, output);
                    result.parserUsed = entry.name;
                    return result;
                } catch {
                    // Continue to next parser
                }
            }
        }

        // Use fallback parser
        const result = this.fallback(command, output);
        if (!result.parserUsed) {
            result.parserUsed = "default";
        }
        return result;
    }

    listParsers(): Array<{ name: string; pattern: string; description: string; priority: number }> {
        return this.parsers.map((p) => ({
            name: p.name,
            pattern: p.pattern.source,
            description: p.description,
            priority: p.priority,
        }));
    }

    setFallback(parser: ParserFunction): void {
        this.fallback = parser;
    }

    private defaultParser(command: string, output: string): ParsedOutput {
        const lines = output.split("\n");
        return {
            command,
            rawOutput: output,
            parsedData: { lines, lineCount: lines.length },
            metadata: { type: "raw" },
            parsedAt: new Date().toISOString(),
            parserUsed: "default",
            parseStatus: "success",
        };
    }

    private registerBuiltinParsers(): void {
        // Hostory parser
        this.register("hostory", /^hostory\s+/, this.parseHostory.bind(this), "Parses hostory output", 100);

        // Repair parser
        this.register("repair", /^repair\s+/, this.parseRepair.bind(this), "Parses repair output", 100);

        // Serfcli parser
        this.register("serfcli", /^serfcli\s+/, this.parseSerfcli.bind(this), "Parses serfcli output", 100);

        // HWC parser
        this.register("hwc", /^hwc\s+/, this.parseHwc.bind(this), "Parses hwc output", 100);

        // Machinechecker parser
        this.register(
            "machinechecker",
            /^machinechecker\s+/,
            this.parseMachinechecker.bind(this),
            "Parses machinechecker output",
            90
        );
    }

    private parseHostory(command: string, output: string): ParsedOutput {
        const lines = output.split("\n");
        const parts = command.split(/\s+/);
        const hostname = parts.length > 1 ? parts[1] : "";

        const events: HostoryEvent[] = [];
        const eventTypes: Record<string, number> = {};

        const eventPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.*)$/;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("---")) {
                continue;
            }

            const matches = eventPattern.exec(trimmed);
            if (matches && matches.length >= 4) {
                const event: HostoryEvent = {
                    timestamp: matches[1],
                    eventType: matches[2],
                    description: matches[3],
                };

                // Extract user if present
                const userMatch = /by\s+(\w+)/.exec(event.description);
                if (userMatch) {
                    event.user = userMatch[1];
                }

                events.push(event);
                eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
            }
        }

        const result: HostoryResult = {
            hostname,
            events,
            summary: {
                totalEvents: events.length,
                eventTypes,
            },
        };

        return {
            command,
            rawOutput: output,
            parsedData: result,
            metadata: { type: "hostory", hostname },
            parsedAt: new Date().toISOString(),
            parserUsed: "hostory",
            parseStatus: "success",
        };
    }

    private parseRepair(command: string, output: string): ParsedOutput {
        const lines = output.split("\n");
        const hostname = this.extractHostnameArg(command, "--host=") || this.extractHostnameArg(command, "-h ");

        const status: RepairStatus = {
            hostname: hostname || "",
            repairState: "",
            actions: [],
        };

        const actionPattern = /^\[(\w+)\]\s+(\w+):\s+(.*)$/;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("State:") || trimmed.startsWith("repair_state:")) {
                status.repairState = trimmed.split(":")[1]?.trim() || "";
            }

            if (trimmed.startsWith("Reason:") || trimmed.startsWith("repair_reason:")) {
                status.repairReason = trimmed.split(":")[1]?.trim();
            }

            const ticketMatch = /T(\d+)/.exec(trimmed);
            if (ticketMatch) {
                status.ticketId = ticketMatch[0];
            }

            const actionMatch = actionPattern.exec(trimmed);
            if (actionMatch && actionMatch.length >= 4) {
                status.actions.push({
                    name: actionMatch[2],
                    status: actionMatch[1],
                    result: actionMatch[3],
                });
            }
        }

        return {
            command,
            rawOutput: output,
            parsedData: status,
            metadata: { type: "repair", hostname },
            parsedAt: new Date().toISOString(),
            parserUsed: "repair",
            parseStatus: "success",
        };
    }

    private parseSerfcli(command: string, output: string): ParsedOutput {
        const lines = output.split("\n");
        const parts = command.split(/\s+/);

        let hostname = "";
        for (let i = 0; i < parts.length; i++) {
            if ((parts[i] === "get" || parts[i] === "status") && i + 1 < parts.length) {
                hostname = parts[i + 1];
                break;
            }
        }

        const attributes: SerfAttribute[] = [];
        const kvPattern = /^([a-zA-Z0-9_.-]+)\s*[:=]\s*(.*)$/;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;

            const matches = kvPattern.exec(trimmed);
            if (matches && matches.length >= 3) {
                attributes.push({
                    key: matches[1],
                    value: matches[2].trim(),
                });
            }
        }

        const result: SerfResult = { hostname, attributes };

        return {
            command,
            rawOutput: output,
            parsedData: result,
            metadata: { type: "serfcli", hostname },
            parsedAt: new Date().toISOString(),
            parserUsed: "serfcli",
            parseStatus: "success",
        };
    }

    private parseHwc(command: string, output: string): ParsedOutput {
        const lines = output.split("\n");
        const isLogOutput = command.includes("log");

        const status: HwcStatus = {
            hostname: "",
            logEntries: [],
            errors: [],
        };

        if (isLogOutput) {
            const logPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s*(\[(\w+)\])?\s*(.*)$/;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const matches = logPattern.exec(trimmed);
                if (matches && matches.length >= 6) {
                    status.logEntries.push({
                        timestamp: matches[1],
                        level: matches[2],
                        component: matches[4] || undefined,
                        message: matches[5].trim(),
                    });
                }
            }
        } else {
            for (const line of lines) {
                const lower = line.toLowerCase();

                if (lower.includes("power state") || lower.includes("power:")) {
                    if (lower.includes("on")) {
                        status.powerState = "on";
                    } else if (lower.includes("off")) {
                        status.powerState = "off";
                    }
                }

                if (lower.includes("bmc") && lower.includes("status")) {
                    if (lower.includes("ok") || lower.includes("healthy")) {
                        status.bmcStatus = "healthy";
                    } else if (lower.includes("error") || lower.includes("fail")) {
                        status.bmcStatus = "error";
                    }
                }

                if (lower.includes("error")) {
                    status.errors.push(line.trim());
                }
            }
        }

        return {
            command,
            rawOutput: output,
            parsedData: status,
            metadata: { type: "hwc", isLog: isLogOutput },
            parsedAt: new Date().toISOString(),
            parserUsed: "hwc",
            parseStatus: "success",
        };
    }

    private parseMachinechecker(command: string, output: string): ParsedOutput {
        const lines = output.split("\n");
        const hostname =
            this.extractHostnameArg(command, "--host ") || this.extractHostnameArg(command, "-h ");

        const result: MachinecheckerResult = {
            hostname: hostname || "",
            overallStatus: "",
            checks: [],
        };

        const checkPattern = /^\[?(PASS|FAIL|WARN|SKIP|OK|ERROR)\]?\s*[-:]?\s*(.*)$/;
        let overallPassed = true;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const lower = trimmed.toLowerCase();
            if (lower.includes("overall") || lower.includes("summary")) {
                if (lower.includes("pass") || lower.includes("healthy")) {
                    result.overallStatus = "PASS";
                } else if (lower.includes("fail")) {
                    result.overallStatus = "FAIL";
                }
            }

            const scoreMatch = /score[:\s]+(\d+)/.exec(lower);
            if (scoreMatch) {
                result.score = parseInt(scoreMatch[1], 10);
            }

            const checkMatch = checkPattern.exec(trimmed);
            if (checkMatch && checkMatch.length >= 3) {
                const check: HealthCheck = {
                    status: checkMatch[1],
                    message: checkMatch[2].trim(),
                    name: "",
                };

                const nameParts = check.message.split(":");
                if (nameParts.length >= 2) {
                    check.name = nameParts[0].trim();
                    check.message = nameParts.slice(1).join(":").trim();
                } else {
                    check.name = check.message;
                }

                switch (check.status) {
                    case "FAIL":
                    case "ERROR":
                        check.severity = "critical";
                        overallPassed = false;
                        break;
                    case "WARN":
                        check.severity = "warning";
                        break;
                    default:
                        check.severity = "info";
                }

                result.checks.push(check);
            }
        }

        if (!result.overallStatus) {
            result.overallStatus = overallPassed ? "PASS" : "FAIL";
        }

        return {
            command,
            rawOutput: output,
            parsedData: result,
            metadata: { type: "machinechecker", hostname },
            parsedAt: new Date().toISOString(),
            parserUsed: "machinechecker",
            parseStatus: "success",
        };
    }

    private extractHostnameArg(command: string, prefix: string): string {
        const idx = command.indexOf(prefix);
        if (idx === -1) return "";

        const rest = command.slice(idx + prefix.length);
        if (rest.startsWith('"') || rest.startsWith("'")) {
            const quote = rest[0];
            const endIdx = rest.indexOf(quote, 1);
            if (endIdx !== -1) {
                return rest.slice(1, endIdx);
            }
        }

        const parts = rest.split(/\s+/);
        return parts[0] || "";
    }
}

// Exporter class for output export
export class OutputExporter {
    export(output: ParsedOutput, format: ExportFormat): string {
        switch (format) {
            case "json":
                return this.toJSON(output);
            case "csv":
                return this.toCSV(output);
            case "markdown":
                return this.toMarkdown(output);
            case "raw":
                return output.rawOutput;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    private toJSON(output: ParsedOutput): string {
        return JSON.stringify(output, null, 2);
    }

    private toCSV(output: ParsedOutput): string {
        const data = output.parsedData;

        if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
            const headers = Object.keys(data[0] as Record<string, unknown>);
            const rows = [headers.join(",")];

            for (const row of data as Array<Record<string, unknown>>) {
                const values = headers.map((h) => {
                    const val = row[h];
                    const str = String(val ?? "");
                    return str.includes(",") ? `"${str}"` : str;
                });
                rows.push(values.join(","));
            }

            return rows.join("\n");
        }

        if (typeof data === "object" && data !== null) {
            const rows = ["Key,Value"];
            for (const [k, v] of Object.entries(data)) {
                const str = String(v ?? "");
                rows.push(`${k},${str.includes(",") ? `"${str}"` : str}`);
            }
            return rows.join("\n");
        }

        const lines = output.rawOutput.split("\n");
        const rows = ["Line,Content"];
        lines.forEach((line, i) => {
            rows.push(`${i + 1},"${line.replace(/"/g, '""')}"`);
        });
        return rows.join("\n");
    }

    private toMarkdown(output: ParsedOutput): string {
        const lines: string[] = [];

        lines.push(`# Command Output: ${output.command}\n`);
        lines.push(`**Parsed At:** ${output.parsedAt}`);
        lines.push(`**Parser Used:** ${output.parserUsed}`);
        lines.push(`**Status:** ${output.parseStatus}\n`);
        lines.push("## Parsed Data\n");

        const data = output.parsedData;
        if (typeof data === "object" && data !== null) {
            lines.push("| Key | Value |");
            lines.push("| --- | --- |");
            for (const [k, v] of Object.entries(data)) {
                lines.push(`| ${k} | ${String(v)} |`);
            }
        } else {
            lines.push("```");
            lines.push(output.rawOutput);
            lines.push("```");
        }

        if (output.errors && output.errors.length > 0) {
            lines.push("\n## Errors\n");
            output.errors.forEach((err) => lines.push(`- ${err}`));
        }

        return lines.join("\n");
    }
}

// Search function
export function searchOutput(output: string, pattern: string, contextLines: number = 2): SearchResult[] {
    let regex: RegExp;
    try {
        regex = new RegExp(pattern, "gi");
    } catch {
        throw new Error(`Invalid search pattern: ${pattern}`);
    }

    const lines = output.split("\n");
    const results: SearchResult[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        regex.lastIndex = 0;
        const match = regex.exec(line);

        if (match) {
            const start = Math.max(0, i - contextLines);
            const end = Math.min(lines.length, i + contextLines + 1);

            results.push({
                lineNumber: i + 1,
                line,
                matchStart: match.index,
                matchEnd: match.index + match[0].length,
                context: {
                    before: lines.slice(start, i),
                    after: lines.slice(i + 1, end),
                },
            });
        }
    }

    return results;
}

// Singleton instance
let registryInstance: OutputParserRegistry | null = null;

export function getParserRegistry(): OutputParserRegistry {
    if (!registryInstance) {
        registryInstance = new OutputParserRegistry();
    }
    return registryInstance;
}

export function parseOutput(command: string, output: string): ParsedOutput {
    return getParserRegistry().parse(command, output);
}

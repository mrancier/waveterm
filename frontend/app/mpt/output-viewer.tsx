// Copyright 2025, Meta Platforms, Inc.
// SPDX-License-Identifier: Apache-2.0

// Output Viewer Component for Meta ProdOps Terminal
// Provides output display, search, and export functionality

import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    ExportFormat,
    OutputExporter,
    ParsedOutput,
    SearchResult,
    parseOutput,
    searchOutput,
} from "./services/output-parser";
import "./quickconnect.scss";

interface OutputViewerProps {
    command?: string;
    output: string;
    sessionId?: string;
    onExport?: (format: ExportFormat, content: string) => void;
    className?: string;
}

const OutputViewerComponent = ({
    command = "",
    output,
    sessionId,
    onExport,
    className,
}: OutputViewerProps) => {
    const [viewMode, setViewMode] = useState<"raw" | "parsed" | "search">("raw");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const [parsedOutput, setParsedOutput] = useState<ParsedOutput | null>(null);
    const [exportFormat, setExportFormat] = useState<ExportFormat>("json");

    // Parse output when command or output changes
    useEffect(() => {
        if (command && output) {
            const parsed = parseOutput(command, output);
            setParsedOutput(parsed);
        } else {
            setParsedOutput(null);
        }
    }, [command, output]);

    // Search when query changes
    useEffect(() => {
        if (searchQuery && output) {
            try {
                const results = searchOutput(output, searchQuery, 2);
                setSearchResults(results);
                setSelectedResultIndex(0);
            } catch {
                setSearchResults([]);
            }
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, output]);

    // Handle export
    const handleExport = useCallback(() => {
        if (!parsedOutput) return;

        const exporter = new OutputExporter();
        try {
            const content = exporter.export(parsedOutput, exportFormat);
            if (onExport) {
                onExport(exportFormat, content);
            } else {
                // Copy to clipboard
                navigator.clipboard.writeText(content);
            }
        } catch (err) {
            console.error("Export failed:", err);
        }
    }, [parsedOutput, exportFormat, onExport]);

    // Navigate search results
    const navigateResults = useCallback(
        (direction: "next" | "prev") => {
            if (searchResults.length === 0) return;

            if (direction === "next") {
                setSelectedResultIndex((prev) => (prev + 1) % searchResults.length);
            } else {
                setSelectedResultIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
            }
        },
        [searchResults.length]
    );

    // Keyboard handler for search navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (viewMode !== "search") return;

            if (e.key === "F3" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                navigateResults("next");
            } else if ((e.key === "F3" && e.shiftKey) || (e.key === "Enter" && e.shiftKey)) {
                e.preventDefault();
                navigateResults("prev");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [viewMode, navigateResults]);

    // Line numbers for raw view
    const lines = useMemo(() => output.split("\n"), [output]);

    // Render raw output with line numbers
    const renderRawOutput = () => (
        <div className="output-raw">
            <table className="output-lines">
                <tbody>
                    {lines.map((line, i) => (
                        <tr
                            key={i}
                            className={clsx("output-line", {
                                highlighted: searchResults.some((r) => r.lineNumber === i + 1),
                                selected:
                                    searchResults.length > 0 &&
                                    searchResults[selectedResultIndex]?.lineNumber === i + 1,
                            })}
                        >
                            <td className="line-number">{i + 1}</td>
                            <td className="line-content">
                                {highlightMatches(
                                    line,
                                    searchQuery,
                                    searchResults.some((r) => r.lineNumber === i + 1)
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // Render parsed output
    const renderParsedOutput = () => {
        if (!parsedOutput) {
            return <div className="output-empty">No parsed data available</div>;
        }

        const data = parsedOutput.parsedData;

        return (
            <div className="output-parsed">
                <div className="parsed-header">
                    <span className="parser-badge">{parsedOutput.parserUsed}</span>
                    <span className="status-badge" data-status={parsedOutput.parseStatus}>
                        {parsedOutput.parseStatus}
                    </span>
                    <span className="timestamp">{parsedOutput.parsedAt}</span>
                </div>

                <div className="parsed-content">{renderParsedData(data)}</div>

                {parsedOutput.errors && parsedOutput.errors.length > 0 && (
                    <div className="parsed-errors">
                        <h4>Errors</h4>
                        <ul>
                            {parsedOutput.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    // Render search results
    const renderSearchResults = () => (
        <div className="output-search">
            <div className="search-header">
                <span className="search-count">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                    {searchResults.length > 0 && ` (${selectedResultIndex + 1}/${searchResults.length})`}
                </span>
                <div className="search-nav">
                    <button
                        className="nav-btn"
                        onClick={() => navigateResults("prev")}
                        disabled={searchResults.length === 0}
                    >
                        <i className="fa-sharp fa-solid fa-chevron-up" />
                    </button>
                    <button
                        className="nav-btn"
                        onClick={() => navigateResults("next")}
                        disabled={searchResults.length === 0}
                    >
                        <i className="fa-sharp fa-solid fa-chevron-down" />
                    </button>
                </div>
            </div>

            <div className="search-results">
                {searchResults.map((result, i) => (
                    <div
                        key={i}
                        className={clsx("search-result", { selected: i === selectedResultIndex })}
                        onClick={() => setSelectedResultIndex(i)}
                    >
                        <div className="result-line-number">Line {result.lineNumber}</div>
                        <div className="result-context">
                            {result.context.before.map((line, j) => (
                                <div key={`before-${j}`} className="context-line before">
                                    {line}
                                </div>
                            ))}
                            <div className="context-line match">
                                {highlightMatches(result.line, searchQuery, true)}
                            </div>
                            {result.context.after.map((line, j) => (
                                <div key={`after-${j}`} className="context-line after">
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {searchResults.length === 0 && searchQuery && (
                    <div className="no-results">No matches found for "{searchQuery}"</div>
                )}
            </div>
        </div>
    );

    return (
        <div className={clsx("output-viewer", className)}>
            <div className="viewer-toolbar">
                <div className="toolbar-left">
                    <div className="view-mode-tabs">
                        <button
                            className={clsx("tab", { active: viewMode === "raw" })}
                            onClick={() => setViewMode("raw")}
                        >
                            <i className="fa-sharp fa-solid fa-terminal" />
                            Raw
                        </button>
                        <button
                            className={clsx("tab", { active: viewMode === "parsed" })}
                            onClick={() => setViewMode("parsed")}
                            disabled={!parsedOutput}
                        >
                            <i className="fa-sharp fa-solid fa-code" />
                            Parsed
                        </button>
                        <button
                            className={clsx("tab", { active: viewMode === "search" })}
                            onClick={() => setViewMode("search")}
                        >
                            <i className="fa-sharp fa-solid fa-search" />
                            Search
                        </button>
                    </div>

                    {(viewMode === "search" || viewMode === "raw") && (
                        <div className="search-input-container">
                            <i className="fa-sharp fa-solid fa-search search-icon" />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search output..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="clear-search" onClick={() => setSearchQuery("")}>
                                    <i className="fa-sharp fa-solid fa-xmark" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="toolbar-right">
                    <select
                        className="export-format"
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="markdown">Markdown</option>
                        <option value="raw">Raw</option>
                    </select>
                    <button
                        className="export-btn"
                        onClick={handleExport}
                        disabled={!output}
                        title="Export output"
                    >
                        <i className="fa-sharp fa-solid fa-download" />
                        Export
                    </button>
                </div>
            </div>

            <div className="viewer-content">
                {viewMode === "raw" && renderRawOutput()}
                {viewMode === "parsed" && renderParsedOutput()}
                {viewMode === "search" && renderSearchResults()}
            </div>

            {sessionId && (
                <div className="viewer-footer">
                    <span className="session-id">Session: {sessionId}</span>
                    <span className="line-count">{lines.length} lines</span>
                </div>
            )}
        </div>
    );
};

// Helper function to highlight matches
function highlightMatches(text: string, query: string, shouldHighlight: boolean): React.ReactNode {
    if (!shouldHighlight || !query) return text;

    try {
        const regex = new RegExp(`(${query})`, "gi");
        const parts = text.split(regex);

        return (
            <>
                {parts.map((part, i) =>
                    regex.test(part) ? (
                        <mark key={i} className="highlight">
                            {part}
                        </mark>
                    ) : (
                        part
                    )
                )}
            </>
        );
    } catch {
        return text;
    }
}

// Helper function to render parsed data recursively
function renderParsedData(data: unknown, depth: number = 0): React.ReactNode {
    if (data === null || data === undefined) {
        return <span className="data-null">null</span>;
    }

    if (typeof data === "string") {
        return <span className="data-string">"{data}"</span>;
    }

    if (typeof data === "number") {
        return <span className="data-number">{data}</span>;
    }

    if (typeof data === "boolean") {
        return <span className="data-boolean">{data.toString()}</span>;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) {
            return <span className="data-empty">[]</span>;
        }

        // Check if it's an array of objects (tabular data)
        if (data.every((item) => typeof item === "object" && item !== null)) {
            const headers = Object.keys(data[0] as object);
            return (
                <table className="data-table">
                    <thead>
                        <tr>
                            {headers.map((h) => (
                                <th key={h}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i}>
                                {headers.map((h) => (
                                    <td key={h}>{renderParsedData((row as Record<string, unknown>)[h], depth + 1)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        return (
            <ul className="data-array">
                {data.map((item, i) => (
                    <li key={i}>{renderParsedData(item, depth + 1)}</li>
                ))}
            </ul>
        );
    }

    if (typeof data === "object") {
        const entries = Object.entries(data);
        if (entries.length === 0) {
            return <span className="data-empty">{"{}"}</span>;
        }

        return (
            <dl className="data-object">
                {entries.map(([key, value]) => (
                    <div key={key} className="data-entry">
                        <dt>{key}</dt>
                        <dd>{renderParsedData(value, depth + 1)}</dd>
                    </div>
                ))}
            </dl>
        );
    }

    return String(data);
}

export const OutputViewer = memo(OutputViewerComponent) as typeof OutputViewerComponent;

// Export styles for the component
export const outputViewerStyles = `
.output-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1e1e1e);
    border-radius: 8px;
    overflow: hidden;
}

.viewer-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary, #252525);
    border-bottom: 1px solid var(--border-color, #333);
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.view-mode-tabs {
    display: flex;
    gap: 4px;
}

.view-mode-tabs .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    transition: all 0.2s;
}

.view-mode-tabs .tab:hover:not(:disabled) {
    background: var(--bg-hover, #333);
    color: var(--text-primary, #fff);
}

.view-mode-tabs .tab.active {
    background: var(--accent-color, #0078d4);
    color: #fff;
}

.view-mode-tabs .tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.search-input-container {
    display: flex;
    align-items: center;
    background: var(--bg-input, #333);
    border-radius: 4px;
    padding: 4px 8px;
}

.search-icon {
    color: var(--text-secondary, #888);
    margin-right: 8px;
}

.search-input {
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    outline: none;
    font-size: 13px;
    width: 200px;
}

.clear-search {
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    padding: 4px;
}

.export-format {
    background: var(--bg-input, #333);
    border: 1px solid var(--border-color, #444);
    color: var(--text-primary, #fff);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
}

.export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--accent-color, #0078d4);
    border: none;
    color: #fff;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
}

.export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.viewer-content {
    flex: 1;
    overflow: auto;
    padding: 12px;
}

.output-raw {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
}

.output-lines {
    width: 100%;
    border-collapse: collapse;
}

.output-line {
    transition: background 0.2s;
}

.output-line.highlighted {
    background: rgba(255, 200, 0, 0.1);
}

.output-line.selected {
    background: rgba(255, 200, 0, 0.25);
}

.line-number {
    color: var(--text-tertiary, #666);
    padding-right: 16px;
    text-align: right;
    user-select: none;
    width: 50px;
}

.line-content {
    white-space: pre-wrap;
    word-break: break-all;
}

.highlight {
    background: #ffcc00;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
}

.output-parsed {
    font-size: 13px;
}

.parsed-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.parser-badge {
    background: var(--accent-color, #0078d4);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

.status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.status-badge[data-status="success"] {
    background: #28a745;
    color: #fff;
}

.status-badge[data-status="partial"] {
    background: #ffc107;
    color: #000;
}

.status-badge[data-status="failed"] {
    background: #dc3545;
    color: #fff;
}

.timestamp {
    color: var(--text-secondary, #888);
    font-size: 12px;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
}

.data-table th,
.data-table td {
    padding: 8px 12px;
    text-align: left;
    border: 1px solid var(--border-color, #333);
}

.data-table th {
    background: var(--bg-secondary, #252525);
    font-weight: 500;
}

.data-object {
    margin: 0;
}

.data-entry {
    display: flex;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-color, #333);
}

.data-entry dt {
    font-weight: 500;
    width: 150px;
    color: var(--text-secondary, #888);
}

.data-entry dd {
    margin: 0;
    flex: 1;
}

.data-string { color: #ce9178; }
.data-number { color: #b5cea8; }
.data-boolean { color: #569cd6; }
.data-null { color: #808080; font-style: italic; }

.search-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #333);
    margin-bottom: 12px;
}

.search-count {
    color: var(--text-secondary, #888);
    font-size: 13px;
}

.search-nav {
    display: flex;
    gap: 4px;
}

.nav-btn {
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #444);
    color: var(--text-primary, #fff);
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
}

.nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.search-result {
    padding: 12px;
    background: var(--bg-secondary, #252525);
    border-radius: 4px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.search-result:hover {
    background: var(--bg-hover, #333);
}

.search-result.selected {
    border-left: 3px solid var(--accent-color, #0078d4);
}

.result-line-number {
    font-weight: 500;
    margin-bottom: 8px;
    color: var(--accent-color, #0078d4);
}

.result-context {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
}

.context-line {
    padding: 2px 0;
}

.context-line.before,
.context-line.after {
    color: var(--text-tertiary, #666);
}

.context-line.match {
    background: rgba(255, 200, 0, 0.1);
}

.no-results {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary, #888);
}

.viewer-footer {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-secondary, #252525);
    border-top: 1px solid var(--border-color, #333);
    font-size: 12px;
    color: var(--text-secondary, #888);
}

.output-empty {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary, #888);
}

.parsed-errors {
    margin-top: 16px;
    padding: 12px;
    background: rgba(220, 53, 69, 0.1);
    border-radius: 4px;
}

.parsed-errors h4 {
    color: #dc3545;
    margin: 0 0 8px;
}

.parsed-errors ul {
    margin: 0;
    padding-left: 20px;
}
`;

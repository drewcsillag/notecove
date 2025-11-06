/**
 * Timeline Visualizer - Generates ASCII and HTML timeline visualizations
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions */

import * as fs from 'fs/promises';
import type { Event, EventLog } from './event-log.js';

export interface TimelineConfig {
  // Filter options
  noteId?: string; // Show only events for this note
  startTime?: number;
  endTime?: number;

  // Display options
  maxEvents?: number; // Limit number of events shown
  showSequenceNumbers?: boolean;
}

/**
 * Generate ASCII timeline for console output
 */
export function generateASCIITimeline(eventLog: EventLog, config: TimelineConfig = {}): string {
  let events = eventLog.getEvents();

  // Apply filters
  if (config.noteId) {
    events = events.filter((e) => e.noteId === config.noteId);
  }
  if (config.startTime !== undefined) {
    events = events.filter((e) => e.timestamp >= config.startTime!);
  }
  if (config.endTime !== undefined) {
    events = events.filter((e) => e.timestamp <= config.endTime!);
  }
  if (config.maxEvents) {
    events = events.slice(0, config.maxEvents);
  }

  if (events.length === 0) {
    return 'No events to display\n';
  }

  const lines: string[] = [];
  const startTime = events[0].timestamp;

  // Header
  lines.push('═'.repeat(120));
  lines.push(
    `Time (s) │ Instance 1                              │ Sync Daemon                   │ Instance 2`
  );
  lines.push('─'.repeat(120));

  for (const event of events) {
    const relativeTime = ((event.timestamp - startTime) / 1000).toFixed(3);
    const timePadded = relativeTime.padStart(8);

    // Build event description
    const desc = formatEventDescription(event, config.showSequenceNumbers || false);

    // Determine which column
    let instance1Col = '';
    let syncCol = '';
    let instance2Col = '';

    if (event.instanceId === 'instance-1') {
      instance1Col = desc;
    } else if (event.instanceId === 'sync-daemon') {
      syncCol = desc;
    } else if (event.instanceId === 'instance-2') {
      instance2Col = desc;
    }

    // Pad columns to fixed width
    instance1Col = instance1Col.padEnd(40);
    syncCol = syncCol.padEnd(30);
    instance2Col = instance2Col.padEnd(40);

    lines.push(`${timePadded} │ ${instance1Col} │ ${syncCol} │ ${instance2Col}`);
  }

  lines.push('═'.repeat(120));

  return lines.join('\n') + '\n';
}

/**
 * Format event description
 */
function formatEventDescription(event: Event, showSequence: boolean): string {
  const parts: string[] = [];

  // Event type
  const typeFormatted = event.type.toUpperCase().replace(/-/g, '_');
  parts.push(typeFormatted);

  // Note info
  if (event.noteId) {
    const noteShort = event.noteId.substring(0, 8);
    parts.push(noteShort);

    if (event.noteTitle) {
      parts.push(`"${event.noteTitle}"`);
    }

    if (showSequence && event.sequenceNumber !== undefined) {
      parts.push(`seq:${event.sequenceNumber}`);
    }
  }

  // File info
  if (event.filePath && !event.noteId) {
    const fileName = event.filePath.split('/').pop() || event.filePath;
    parts.push(fileName);
  }

  // Size info
  if (event.fileSize !== undefined) {
    parts.push(`${event.fileSize}b`);
  }

  // Metadata highlights
  if (event.metadata) {
    if (event.metadata.delayMs) {
      parts.push(`delay:${event.metadata.delayMs}ms`);
    }
    if (event.metadata.isPartial) {
      parts.push('PARTIAL');
    }
  }

  return parts.join(' ');
}

/**
 * Generate HTML timeline
 */
export async function generateHTMLTimeline(
  eventLog: EventLog,
  outputPath: string,
  config: TimelineConfig = {}
): Promise<void> {
  let events = eventLog.getEvents();

  // Apply filters
  if (config.noteId) {
    events = events.filter((e) => e.noteId === config.noteId);
  }
  if (config.startTime !== undefined) {
    events = events.filter((e) => e.timestamp >= config.startTime!);
  }
  if (config.endTime !== undefined) {
    events = events.filter((e) => e.timestamp <= config.endTime!);
  }

  const stats = eventLog.getStats();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fuzz Test Timeline</title>
  <style>
    body {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      margin: 20px;
      background: #1e1e1e;
      color: #d4d4d4;
    }

    h1 {
      color: #4ec9b0;
      border-bottom: 2px solid #4ec9b0;
      padding-bottom: 10px;
    }

    .stats {
      background: #252526;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .stat-item {
      padding: 10px;
      background: #2d2d30;
      border-radius: 3px;
    }

    .stat-label {
      color: #858585;
      font-size: 10px;
    }

    .stat-value {
      color: #4ec9b0;
      font-size: 18px;
      font-weight: bold;
    }

    .timeline {
      background: #252526;
      padding: 20px;
      border-radius: 5px;
      overflow-x: auto;
    }

    .event {
      display: grid;
      grid-template-columns: 100px 350px 350px 350px;
      gap: 10px;
      padding: 8px;
      border-bottom: 1px solid #3e3e42;
      align-items: start;
    }

    .event:hover {
      background: #2d2d30;
    }

    .event-time {
      color: #858585;
      font-size: 11px;
    }

    .event-instance {
      padding: 5px 10px;
      border-radius: 3px;
      font-size: 11px;
    }

    .event-instance-1 { background: #264f78; }
    .event-instance-2 { background: #4d4d1e; }
    .event-sync { background: #3e1e4d; }

    .event-type {
      font-weight: bold;
      color: #dcdcaa;
    }

    .event-create { color: #4ec9b0; }
    .event-edit { color: #569cd6; }
    .event-delete { color: #f48771; }
    .event-sync { color: #c586c0; }
    .event-gc { color: #ce9178; }

    .event-note {
      color: #9cdcfe;
      font-size: 10px;
    }

    .event-seq {
      color: #b5cea8;
      font-size: 10px;
    }

    .event-title {
      color: #858585;
      font-style: italic;
      font-size: 10px;
    }

    .event-metadata {
      color: #858585;
      font-size: 10px;
      margin-top: 3px;
    }

    .filters {
      background: #252526;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }

    .filter-input {
      background: #3c3c3c;
      border: 1px solid #555;
      color: #d4d4d4;
      padding: 5px 10px;
      border-radius: 3px;
      font-family: inherit;
      margin-right: 10px;
    }

    .filter-button {
      background: #0e639c;
      border: none;
      color: white;
      padding: 5px 15px;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
    }

    .filter-button:hover {
      background: #1177bb;
    }
  </style>
</head>
<body>
  <h1>📊 Fuzz Test Timeline</h1>

  <div class="stats">
    <h3>Statistics</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-label">Total Events</div>
        <div class="stat-value">${stats.totalEvents}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Notes Created</div>
        <div class="stat-value">${stats.eventsByType.create || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Edits</div>
        <div class="stat-value">${stats.eventsByType.edit || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Syncs</div>
        <div class="stat-value">${stats.eventsByType['sync-completed'] || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Partial Writes</div>
        <div class="stat-value">${stats.eventsByType['partial-write-started'] || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">GC Triggered</div>
        <div class="stat-value">${stats.eventsByType['gc-triggered'] || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Snapshots</div>
        <div class="stat-value">${stats.eventsByType['snapshot-created'] || 0}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Duration</div>
        <div class="stat-value">${(stats.timespan.durationMs / 1000).toFixed(1)}s</div>
      </div>
    </div>
  </div>

  <div class="filters">
    <h3>Filters</h3>
    <input type="text" id="noteIdFilter" class="filter-input" placeholder="Note ID">
    <button class="filter-button" onclick="applyFilters()">Apply</button>
    <button class="filter-button" onclick="clearFilters()">Clear</button>
  </div>

  <div class="timeline" id="timeline">
  </div>

  <script>
    const allEvents = ${JSON.stringify(events)};

    function applyFilters() {
      const noteId = document.getElementById('noteIdFilter').value.trim();

      let filtered = allEvents;
      if (noteId) {
        filtered = filtered.filter(e => e.noteId && e.noteId.includes(noteId));
      }

      renderTimeline(filtered);
    }

    function clearFilters() {
      document.getElementById('noteIdFilter').value = '';
      renderTimeline(allEvents);
    }

    function renderTimeline(events) {
      const timeline = document.getElementById('timeline');
      const startTime = allEvents[0].timestamp;
      timeline.innerHTML = events.map(e => generateEventHTML(e, startTime)).join('\\n');
    }

    // Initialize timeline on load
    renderTimeline(allEvents);

    function generateEventHTML(event, startTime) {
      const relativeTime = ((event.timestamp - startTime) / 1000).toFixed(3);

      let html = '<div class="event">';
      html += '<div class="event-time">' + relativeTime + 's</div>';

      // Three columns for instances
      for (const instance of ['instance-1', 'sync-daemon', 'instance-2']) {
        if (event.instanceId === instance) {
          html += '<div class="event-instance event-' + instance + '">';
          html += '<div class="event-type event-' + event.type.split('-')[0] + '">';
          html += event.type.toUpperCase().replace(/-/g, '_');
          html += '</div>';

          if (event.noteId) {
            html += '<div class="event-note">Note: ' + event.noteId.substring(0, 12) + '</div>';
          }
          if (event.noteTitle) {
            html += '<div class="event-title">"' + event.noteTitle + '"</div>';
          }
          if (event.sequenceNumber !== undefined) {
            html += '<div class="event-seq">Seq: ' + event.sequenceNumber + '</div>';
          }
          if (event.metadata) {
            html += '<div class="event-metadata">' + JSON.stringify(event.metadata) + '</div>';
          }

          html += '</div>';
        } else {
          html += '<div></div>';
        }
      }

      html += '</div>';
      return html;
    }
  </script>
</body>
</html>
`;

  await fs.writeFile(outputPath, html, 'utf-8');
}

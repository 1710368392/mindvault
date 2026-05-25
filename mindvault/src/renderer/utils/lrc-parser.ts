export interface LrcLine {
  time: number; // seconds
  text: string;
  translation?: string; // translation text if available
}

export interface LrcMetadata {
  title?: string;
  artist?: string;
  album?: string;
  by?: string;
  offset?: number; // offset in milliseconds
}

export interface ParsedLrc {
  metadata: LrcMetadata;
  lines: LrcLine[];
}

/**
 * Parse LRC format lyrics content
 * Supports:
 * - Standard: [mm:ss.xx]text
 * - Multiple timestamps: [mm:ss.xx][mm:ss.xx]text
 * - Metadata tags: [ti:Title], [ar:Artist], [al:Album], [by:Creator], [offset:ms]
 * - Translation lines: text after translation separator
 * - Empty lines are skipped
 * - Lines are sorted by time
 */
export function parseLrc(lrcContent: string): ParsedLrc {
  const metadata: LrcMetadata = {};
  const lines: LrcLine[] = [];

  if (!lrcContent || typeof lrcContent !== 'string') {
    return { metadata, lines };
  }

  // Metadata tag patterns
  const metaPatterns: Record<string, keyof LrcMetadata> = {
    ti: 'title',
    ar: 'artist',
    al: 'album',
    by: 'by',
    offset: 'offset',
  };

  // Regex to match timestamps: [mm:ss.xx] or [mm:ss]
  const timestampRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  // Split into lines
  const rawLines = lrcContent.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check if this is a metadata line (no timestamps, just [key:value])
    const metaMatch = trimmed.match(/^\[([a-zA-Z]+):(.+)\]$/);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (key in metaPatterns) {
        const metaKey = metaPatterns[key];
        if (metaKey === 'offset') {
          metadata[metaKey] = parseInt(value, 10) || 0;
        } else {
          (metadata as Record<string, string>)[metaKey] = value;
        }
      }
      continue;
    }

    // Extract all timestamps from the line
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timestampRegex.lastIndex = 0;

    while ((match = timestampRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let centiseconds = 0;
      if (match[3]) {
        // Handle both 2-digit and 3-digit millisecond formats
        if (match[3].length === 3) {
          centiseconds = parseInt(match[3], 10) / 10;
        } else {
          centiseconds = parseInt(match[3], 10);
        }
      }
      timestamps.push(minutes * 60 + seconds + centiseconds / 100);
    }

    if (timestamps.length === 0) continue;

    // Extract the text after all timestamps
    const text = trimmed.replace(/\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
    if (!text) continue;

    // Create a line for each timestamp (handles multiple timestamps per line)
    for (const time of timestamps) {
      // Check for translation separator (e.g., "original / translation" or "original /translation")
      const translationSeparator = ' / ';
      const separatorIndex = text.indexOf(translationSeparator);

      if (separatorIndex > 0) {
        lines.push({
          time,
          text: text.substring(0, separatorIndex).trim(),
          translation: text.substring(separatorIndex + translationSeparator.length).trim(),
        });
      } else {
        lines.push({ time, text });
      }
    }
  }

  // Apply offset if present
  if (metadata.offset && metadata.offset !== 0) {
    const offsetSeconds = metadata.offset / 1000;
    for (const line of lines) {
      line.time += offsetSeconds;
    }
  }

  // Sort by time
  lines.sort((a, b) => a.time - b.time);

  return { metadata, lines };
}

/**
 * Find the current lyric line index based on playback time
 * Returns the index of the line that should be highlighted
 * Returns -1 if no line matches
 */
export function findCurrentLineIndex(lines: LrcLine[], currentTime: number): number {
  if (!lines || lines.length === 0) return -1;

  // Binary search: find the last line whose time <= currentTime
  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Try to find a matching LRC file for an audio file
 * Checks for same name with .lrc extension in the same directory
 * This is a utility hint - actual file loading needs IPC
 */
export function getExpectedLrcPath(audioPath: string): string {
  if (!audioPath) return '';
  const lastDotIndex = audioPath.lastIndexOf('.');
  if (lastDotIndex === -1) return audioPath + '.lrc';
  return audioPath.substring(0, lastDotIndex) + '.lrc';
}

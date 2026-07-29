export interface SerialRangeGroup {
  prefix: string;
  start?: string;
  end?: string;
  startNum: number;
  endNum: number;
  count: number;
  text: string;
  formattedRange: string;
}

export interface SerialGroupingResult {
  ranges: SerialRangeGroup[];
  standalone: string[];
  allSerials: string[];
  formattedSummary: string;
}

export function generateSerialRangeHelper(
  start: string | number,
  end: string | number,
  count: number = 1,
  fallbackPrefix: string = 'BAT'
): string[] {
  const result: string[] = [];
  const startStr = String(start || '').trim();
  const endStr = String(end || '').trim();

  // Regex accepts spaces, dashes, slashes, and custom prefixes (e.g. "Senzo 201")
  const startMatch = startStr.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);
  const endMatch = endStr.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/i);

  if (startMatch) {
    const prefix = startMatch[1] !== undefined ? startMatch[1] : `${fallbackPrefix} `;
    const startInt = parseInt(startMatch[2], 10);
    const padLength = startMatch[2].length;
    let targetCount = Math.max(1, count || 1);

    if (endMatch) {
      const endInt = parseInt(endMatch[2], 10);
      if (!isNaN(endInt) && endInt >= startInt) {
        targetCount = Math.max(targetCount, endInt - startInt + 1);
      }
    }

    for (let i = 0; i < targetCount; i++) {
      const numStr = String(startInt + i).padStart(padLength, '0');
      result.push(`${prefix}${numStr}`);
    }
    return result;
  }

  // Fallback
  const cleanPrefix = fallbackPrefix.trim() || 'BAT';
  const numQty = Math.max(1, count || 1);
  for (let i = 1; i <= numQty; i++) {
    const numStr = String(i).padStart(4, '0');
    result.push(`${cleanPrefix}-${numStr}`);
  }
  return result;
}

export function groupSerialsIntoRangesAndIndividuals(
  serialNumbers: string[] = [],
  startNo?: string,
  endNo?: string,
  quantity: number = 0,
  fallbackPrefix: string = 'BAT'
): SerialGroupingResult {
  let serials = [...(serialNumbers || [])].map(s => String(s).trim()).filter(Boolean);

  if (serials.length === 0 && (startNo || quantity > 0)) {
    serials = generateSerialRangeHelper(startNo || '1', endNo || String(quantity), quantity, fallbackPrefix);
  }

  if (serials.length === 0) {
    return { ranges: [], standalone: [], allSerials: [], formattedSummary: 'No Serials' };
  }

  const parsedItems: { raw: string; prefix: string; num: number | null; numStr: string }[] = serials.map(s => {
    const match = s.match(/^(.*?[\s\-_/\\#]*?)(\d+)$/);
    if (match) {
      return { raw: s, prefix: match[1] || '', num: parseInt(match[2], 10), numStr: match[2] };
    }
    return { raw: s, prefix: s, num: null, numStr: '' };
  });

  const ranges: SerialRangeGroup[] = [];
  const standalone: string[] = [];
  const prefixGroups: { [prefix: string]: typeof parsedItems } = {};

  parsedItems.forEach(item => {
    if (item.num !== null) {
      if (!prefixGroups[item.prefix]) prefixGroups[item.prefix] = [];
      prefixGroups[item.prefix].push(item);
    } else {
      standalone.push(item.raw);
    }
  });

  Object.keys(prefixGroups).forEach(prefix => {
    const items = prefixGroups[prefix].sort((a, b) => (a.num! - b.num!));
    let rangeStart = items[0];
    let rangePrev = items[0];
    let currentCount = 1;

    for (let i = 1; i < items.length; i++) {
      const curr = items[i];
      if (curr.num === rangePrev.num! + 1) {
        rangePrev = curr;
        currentCount++;
      } else {
        if (currentCount >= 2) {
          ranges.push({
            prefix,
            start: rangeStart.raw,
            end: rangePrev.raw,
            startNum: rangeStart.num!,
            endNum: rangePrev.num!,
            count: currentCount,
            text: `${rangeStart.raw} → ${rangePrev.raw}`,
            formattedRange: `${rangeStart.raw} → ${rangePrev.raw}`
          });
        } else {
          standalone.push(rangeStart.raw);
        }
        rangeStart = curr;
        rangePrev = curr;
        currentCount = 1;
      }
    }

    if (currentCount >= 2) {
      ranges.push({
        prefix,
        start: rangeStart.raw,
        end: rangePrev.raw,
        startNum: rangeStart.num!,
        endNum: rangePrev.num!,
        count: currentCount,
        text: `${rangeStart.raw} → ${rangePrev.raw}`,
        formattedRange: `${rangeStart.raw} → ${rangePrev.raw}`
      });
    } else {
      standalone.push(rangeStart.raw);
    }
  });

  const summaryParts: string[] = [];
  ranges.forEach(r => summaryParts.push(`${r.formattedRange} (${r.count} ${r.count === 1 ? 'Battery' : 'Batteries'})`));
  if (standalone.length > 0) {
    summaryParts.push(`${standalone.length} individual code(s)`);
  }

  return {
    ranges,
    standalone,
    allSerials: serials,
    formattedSummary: summaryParts.join(', ') || `${serials.length} item(s)`
  };
}

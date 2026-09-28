/**
 * `lb changed`: the paragraphs of a chapter that a revision changed, against the copy that verify-chapter
 * keeps of each round. Rounds 2 and 3 check only these spans and the open findings.
 */

/**
 * The lines of `after` that differ from `before`, as inclusive ranges of file lines, each widened to
 * whole paragraphs (runs of non-blank lines). A deletion marks the paragraph where the text was.
 */
export function changedRanges(before: string, after: string): [number, number][] {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  // Longest common subsequence of lines; lcs[i][j] is for a[i..] and b[j..].
  const w = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const changed = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
      changed.add(j++);
    } else {
      // A line of `before` that is gone: mark the nearest non-blank line of `after`.
      let k = Math.min(j, b.length - 1);
      while (k > 0 && b[k].trim() === "") k--;
      if (k >= 0) changed.add(k);
      i++;
    }
  }

  const blank = (k: number) => b[k].trim() === "";
  const ranges: [number, number][] = [];
  for (const k of [...changed].sort((x, y) => x - y)) {
    if (blank(k)) continue;
    let s = k;
    let e = k;
    while (s > 0 && !blank(s - 1)) s--;
    while (e < b.length - 1 && !blank(e + 1)) e++;
    // File lines start at 1. Paragraphs with only a blank line between them become one range.
    const [start, end] = [s + 1, e + 1];
    const last = ranges.at(-1);
    if (last && start <= last[1] + 2) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  return ranges;
}

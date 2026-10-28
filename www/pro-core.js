/* Shared deterministic progress and calendar logic. No entitlements in local saves. */
(function (root) {
  'use strict';
  const LAUNCH = '2026-10-17';
  function dayNumber(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return NaN;
    const n = Date.parse(key + 'T00:00:00Z') / 86400000;
    return Number.isInteger(n) && new Date(n * 86400000).toISOString().slice(0, 10) === key ? n : NaN;
  }
  function available(key, today, count) {
    const n = dayNumber(key), start = dayNumber(LAUNCH);
    return Number.isFinite(n) && n >= start && n < dayNumber(today) && n - start < count;
  }
  function cleanRecord(r) {
    if (!r || typeof r.puzzleId !== 'string' || !Array.isArray(r.slots) || r.slots.length !== 3 ||
      !r.slots.every(w => w === null || typeof w === 'string' && /^[A-Z]{1,32}$/.test(w)) ||
      !Number.isFinite(r.elapsed) || r.elapsed < 0 || !Number.isInteger(r.hintsUsed) || r.hintsUsed < 0 || r.hintsUsed > 1) return null;
    return {puzzleId:r.puzzleId, slots:[...r.slots], elapsed:r.elapsed, hintsUsed:r.hintsUsed,
      completed:r.completed === true, dailyWin:r.dailyWin === true, updatedAt:Number.isFinite(r.updatedAt) ? r.updatedAt : 0};
  }
  function mergeRecord(a, b) {
    a = cleanRecord(a); b = cleanRecord(b);
    if (!a) return b; if (!b) return a;
    // Completion and original Daily wins survive replays and merges independently.
    const winner = a.completed !== b.completed ? (a.completed ? a : b)
      : a.updatedAt !== b.updatedAt ? (a.updatedAt > b.updatedAt ? a : b)
      : (JSON.stringify(a) >= JSON.stringify(b) ? a : b);
    return {...winner, dailyWin:a.dailyWin || b.dailyWin};
  }

  function mergeRecords(a = {}, b = {}) {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!/^(daily:\d{4}-\d{2}-\d{2}|practice:[\w-]{1,120})$/.test(key)) continue;
      const r = mergeRecord(a[key], b[key]); if (r) out[key] = r;
    }
    return out;
  }
  function monthCells(year, month) {
    const first = new Date(Date.UTC(year, month, 1));
    const cells = Array(first.getUTCDay()).fill(null);
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let d=1;d<=days;d++) cells.push(new Date(Date.UTC(year,month,d)).toISOString().slice(0,10));
    return cells;
  }
  const api = {LAUNCH,dayNumber,available,cleanRecord,mergeRecord,mergeRecords,monthCells};
  root.ConduitProCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

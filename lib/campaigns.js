'use strict';

// Pure campaign rules: live window, next transition, whether a play counts, and the
// value it is worth. No I/O here so these are trivial to unit test with fixed clocks.

const TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY_BY_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// { year, month, day, hour, minute, weekday(0=Sun) } for `date`, read in America/Sao_Paulo.
function zonedParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short'
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) parts[part.type] = part.value;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour, minute: Number(parts.minute), second: Number(parts.second),
    weekday: WEEKDAY_BY_SHORT[parts.weekday]
  };
}

// 'YYYY-MM-DD' for `date` in America/Sao_Paulo — used for dashboard day buckets.
function zonedDateKey(date) {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function parseTimeToMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function inWeekdays(campaign, weekday) {
  if (!campaign.weekdays || campaign.weekdays.length === 0) return true;
  return campaign.weekdays.includes(weekday);
}

function inDailyWindow(campaign, minuteOfDay) {
  const start = campaign.dailyStart != null ? parseTimeToMinutes(campaign.dailyStart) : null;
  const end = campaign.dailyEnd != null ? parseTimeToMinutes(campaign.dailyEnd) : null;
  if (start == null || end == null) return true;
  if (start === end) return true; // degenerate window: treat as "all day"
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  // Crosses midnight, e.g. 22:00-02:00.
  return minuteOfDay >= start || minuteOfDay < end;
}

function isLive(campaign, now = new Date()) {
  if (campaign.status !== 'active') return false;
  const ts = now.getTime();
  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  if (!(ts >= startsAt && ts < endsAt)) return false;
  const parts = zonedParts(now);
  if (!inWeekdays(campaign, parts.weekday)) return false;
  if (!inDailyWindow(campaign, parts.hour * 60 + parts.minute)) return false;
  return true;
}

// Next instant (Date) at which isLive(campaign, t) flips relative to isLive(campaign, now),
// capped at ends_at. Scans minute by minute (correct, not optimized) up to 8 days ahead.
function nextChange(campaign, now = new Date()) {
  const endsAt = new Date(campaign.endsAt).getTime();
  if (now.getTime() >= endsAt) return null;
  const currentlyLive = isLive(campaign, now);
  const maxSteps = 8 * 24 * 60; // 8 days in minutes
  let cursor = Math.ceil(now.getTime() / 60000) * 60000;
  for (let i = 0; i < maxSteps; i++) {
    if (cursor >= endsAt) return new Date(endsAt);
    const cursorDate = new Date(cursor);
    if (isLive(campaign, cursorDate) !== currentlyLive) return cursorDate;
    cursor += 60000;
  }
  return new Date(endsAt);
}

// Does this play even apply to this campaign, regardless of whether it is live right now?
function matches(campaign, play) {
  if (campaign.game && campaign.game !== play.game) return false;
  if (campaign.metric === 'deliveries' && play.game !== 'runner') return false;
  return true;
}

function playValue(campaign, play) {
  let raw;
  if (campaign.metric === 'score') raw = Number(play.score) || 0;
  else if (campaign.metric === 'deliveries') raw = Number(play.deliveries) || 0;
  else if (campaign.metric === 'plays') raw = 1;
  else raw = 0;
  return Math.floor(raw * Number(campaign.multiplier || 1));
}

// values: array of numbers (entry values for one player, or for the whole campaign).
function aggregateProgress(values, aggregation) {
  if (!values.length) return 0;
  if (aggregation === 'best') return Math.max(...values);
  return values.reduce((sum, v) => sum + v, 0);
}

module.exports = {
  TIME_ZONE, zonedParts, zonedDateKey, parseTimeToMinutes,
  isLive, nextChange, matches, playValue, aggregateProgress
};

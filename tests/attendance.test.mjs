import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPresentChildIds,
  getConfirmationMeta,
  summarizeDailyAttendance,
} from "../src/lib/attendance.ts";

const row = (overrides = {}) => ({
  child_id: "child-1",
  class_id: "class-1",
  school_id: "school-1",
  attendance_date: "2026-10-06",
  present: true,
  confirmed_by: "user-1",
  confirmed_at: "2026-10-06T09:00:00.000Z",
  child_first_name: "Ana",
  child_last_name: "García",
  class_name: "Aula A1",
  confirmer_name: "Monitor A",
  ...overrides,
});

test("empty rows mean the list was never passed", () => {
  const summary = summarizeDailyAttendance([]);

  assert.equal(summary.status, "never-passed");
  assert.equal(summary.total, 0);
  assert.equal(summary.presentCount, 0);
  assert.equal(summary.absentCount, 0);
});

test("all-absent rows mean an explicitly confirmed empty day", () => {
  const summary = summarizeDailyAttendance([
    row({ child_id: "c1", present: false }),
    row({ child_id: "c2", present: false }),
  ]);

  assert.equal(summary.status, "confirmed-empty");
  assert.equal(summary.total, 2);
  assert.equal(summary.presentCount, 0);
  assert.equal(summary.absentCount, 2);
});

test("mixed rows mean a confirmed day with present children", () => {
  const summary = summarizeDailyAttendance([
    row({ child_id: "c1", present: true }),
    row({ child_id: "c2", present: false }),
  ]);

  assert.equal(summary.status, "confirmed");
  assert.equal(summary.total, 2);
  assert.equal(summary.presentCount, 1);
  assert.equal(summary.absentCount, 1);
});

test("only present children are usable as filter for the later meal record", () => {
  const rows = [
    row({ child_id: "c1", present: true }),
    row({ child_id: "c2", present: false }),
    row({ child_id: "c3", present: true }),
  ];

  assert.deepEqual(filterPresentChildIds(rows), ["c1", "c3"]);
  assert.deepEqual(filterPresentChildIds([]), []);
});

test("confirmation meta exposes who confirmed and when", () => {
  const meta = getConfirmationMeta([
    row({
      confirmed_by: "user-1",
      confirmer_name: "Monitor A",
      confirmed_at: "2026-10-06T09:00:00.000Z",
    }),
    row({
      child_id: "child-2",
      confirmed_by: "user-1",
      confirmer_name: "Monitor A",
      confirmed_at: "2026-10-06T09:05:00.000Z",
    }),
  ]);

  assert.equal(meta.confirmedBy, "user-1");
  assert.equal(meta.confirmerName, "Monitor A");
  assert.equal(meta.confirmedAt, "2026-10-06T09:05:00.000Z");
});

test("confirmation meta is null when the list was never passed", () => {
  assert.equal(getConfirmationMeta([]), null);
});

test("summarizing does not mutate its input", () => {
  const rows = [row({ child_id: "c1", present: true })];
  const snapshot = JSON.parse(JSON.stringify(rows));

  summarizeDailyAttendance(rows);
  filterPresentChildIds(rows);

  assert.deepEqual(rows, snapshot);
});

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Pure function representing the in-memory active children filtering logic in AttendancePage.
 * In AttendancePage.tsx:
 *   const children = useMemo(() => {
 *       if (!classId) return [];
 *       return schoolChildren.filter(c => c.class_id === classId && c.is_active);
 *   }, [schoolChildren, classId]);
 */
export function filterActiveChildrenByClass(schoolChildren, classId) {
  if (!classId) return [];
  return schoolChildren.filter((c) => c.class_id === classId && Boolean(c.is_active));
}

test("returns only active children belonging to the specified class", () => {
  const schoolChildren = [
    { id: "child-1", first_name: "Lucía", last_name: "García", class_id: "class-a", is_active: true },
    { id: "child-2", first_name: "Mateo", last_name: "López", class_id: "class-a", is_active: false },
    { id: "child-3", first_name: "Sofía", last_name: "Martínez", class_id: "class-b", is_active: true },
    { id: "child-4", first_name: "Hugo", last_name: "Sánchez", class_id: "class-b", is_active: false },
  ];

  const classAResult = filterActiveChildrenByClass(schoolChildren, "class-a");
  assert.equal(classAResult.length, 1);
  assert.equal(classAResult[0].id, "child-1");
  assert.equal(classAResult[0].first_name, "Lucía");

  const classBResult = filterActiveChildrenByClass(schoolChildren, "class-b");
  assert.equal(classBResult.length, 1);
  assert.equal(classBResult[0].id, "child-3");
  assert.equal(classBResult[0].first_name, "Sofía");
});

test("returns multiple active children in the same class preserving original order", () => {
  const schoolChildren = [
    { id: "c1", first_name: "Ana", class_id: "class-1", is_active: true },
    { id: "c2", first_name: "Bernardo", class_id: "class-2", is_active: true },
    { id: "c3", first_name: "Carlos", class_id: "class-1", is_active: true },
    { id: "c4", first_name: "Daniela", class_id: "class-1", is_active: false },
    { id: "c5", first_name: "Elena", class_id: "class-1", is_active: true },
  ];

  const result = filterActiveChildrenByClass(schoolChildren, "class-1");
  assert.deepEqual(
    result.map((c) => c.id),
    ["c1", "c3", "c5"]
  );
  assert.deepEqual(
    result.map((c) => c.first_name),
    ["Ana", "Carlos", "Elena"]
  );
});

test("returns empty array when classId is empty string, null, or undefined", () => {
  const schoolChildren = [
    { id: "c1", class_id: "class-1", is_active: true },
    { id: "c2", class_id: "class-2", is_active: true },
  ];

  assert.deepEqual(filterActiveChildrenByClass(schoolChildren, ""), []);
  assert.deepEqual(filterActiveChildrenByClass(schoolChildren, null), []);
  assert.deepEqual(filterActiveChildrenByClass(schoolChildren, undefined), []);
});

test("returns empty array when schoolChildren is empty", () => {
  assert.deepEqual(filterActiveChildrenByClass([], "class-1"), []);
});

test("returns empty array when no children match the selected classId", () => {
  const schoolChildren = [
    { id: "c1", class_id: "class-1", is_active: true },
    { id: "c2", class_id: "class-2", is_active: true },
  ];

  assert.deepEqual(filterActiveChildrenByClass(schoolChildren, "class-non-existent"), []);
});

test("excludes children with falsy or missing is_active flag", () => {
  const schoolChildren = [
    { id: "c1", class_id: "class-1", is_active: true },
    { id: "c2", class_id: "class-1", is_active: false },
    { id: "c3", class_id: "class-1", is_active: undefined },
    { id: "c4", class_id: "class-1", is_active: null },
    { id: "c5", class_id: "class-1" },
  ];

  const result = filterActiveChildrenByClass(schoolChildren, "class-1");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "c1");
});

test("preserves additional child metadata without mutation", () => {
  const child = {
    id: "child-full",
    first_name: "Valeria",
    last_name: "Romero",
    class_id: "class-preschool",
    is_active: true,
    created_at: "2026-09-01T08:00:00Z",
    lunch_weekdays: [1, 2, 3, 4, 5],
    child_allergens: [{ allergen_id: "a1", allergens: { id: "a1", name: "Gluten" } }],
  };
  const schoolChildren = [child];
  const snapshot = JSON.stringify(schoolChildren);

  const result = filterActiveChildrenByClass(schoolChildren, "class-preschool");
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], child);
  assert.deepEqual(result[0].lunch_weekdays, [1, 2, 3, 4, 5]);

  // Input must not be mutated
  assert.equal(JSON.stringify(schoolChildren), snapshot);
});

test("simulates switching classes across single cached schoolChildren roster", () => {
  // Simulates AttendancePage behavior: ChildService.getChildrenBySchool is called once,
  // and switching classrooms recalculates active students synchronously in memory.
  const cachedSchoolChildren = [
    { id: "c1", class_id: "infantil-3", is_active: true },
    { id: "c2", class_id: "infantil-3", is_active: false },
    { id: "c3", class_id: "infantil-4", is_active: true },
    { id: "c4", class_id: "infantil-5", is_active: true },
    { id: "c5", class_id: "infantil-5", is_active: true },
  ];

  // User views Infantil 3
  const viewClass3 = filterActiveChildrenByClass(cachedSchoolChildren, "infantil-3");
  assert.deepEqual(viewClass3.map((c) => c.id), ["c1"]);

  // User switches to Infantil 4 without re-fetching
  const viewClass4 = filterActiveChildrenByClass(cachedSchoolChildren, "infantil-4");
  assert.deepEqual(viewClass4.map((c) => c.id), ["c3"]);

  // User switches to Infantil 5 without re-fetching
  const viewClass5 = filterActiveChildrenByClass(cachedSchoolChildren, "infantil-5");
  assert.deepEqual(viewClass5.map((c) => c.id), ["c4", "c5"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyPrintModel } from "../src/features/menus/utils/monthly-print-model.ts";

const menu = (type, fields = {}) => ({ type, ...fields });

test("builds only weekdays and marks days without a normal menu as no service", () => {
  const model = buildMonthlyPrintModel(2026, 1, {
    "2026-02-02": [{ menu: menu("normal", { first_course: "Sopa" }) }],
    "2026-02-03": [],
  });

  assert.equal(model.days[0].date, "2026-02-02");
  assert.equal(model.days[0].isServiceDay, true);
  assert.deepEqual(model.days[0].base, [{ label: "Primero", value: "Sopa" }]);
  assert.equal(model.days[1].date, "2026-02-03");
  assert.equal(model.days[1].isServiceDay, false);
  assert.deepEqual(model.days[1].base, []);
  assert.ok(model.days.every(({ date }) => ![0, 6].includes(new Date(`${date}T12:00:00`).getDay())));
});

test("separates normal menus from every special variant and hides blank dishes", () => {
  const model = buildMonthlyPrintModel(2026, 1, {
    "2026-02-02": [
      { menu: menu("sin-gluten", { first_course: "Arroz", dessert: " " }) },
      { menu: menu("normal", { first_course: "Sopa", second_course: "", side: "Pan" }) },
      { menu: menu("vegetariano", { second_course: "Tortilla" }) },
    ],
  });
  const day = model.days[0];

  assert.deepEqual(day.base, [
    { label: "Primero", value: "Sopa" },
    { label: "Guarnición", value: "Pan" },
  ]);
  assert.deepEqual(day.variants, [
    { label: "sin-gluten", dishes: [{ label: "Primero", value: "Arroz" }] },
    { label: "vegetariano", dishes: [{ label: "Segundo", value: "Tortilla" }] },
  ]);
});

test("supports a month with no menus as weekday no-service days", () => {
  const model = buildMonthlyPrintModel(2026, 1, {});

  assert.equal(model.days.length, 20);
  assert.ok(model.days.every((day) => !day.isServiceDay && day.variants.length === 0));
});

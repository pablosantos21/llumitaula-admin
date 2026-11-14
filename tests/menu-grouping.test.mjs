import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSchoolKey,
  formatAllergenKey,
  groupChildrenByAllergenKey,
  detectChangedDishes,
  pairBaseMenusWithVariants,
  DISH_FIELDS,
} from "../src/features/menus/utils/menu-grouping.ts";

test("DISH_FIELDS contains canonical bilingual 5-course definition", () => {
  assert.equal(DISH_FIELDS.length, 5);
  assert.deepEqual(
    DISH_FIELDS.map((d) => d.field),
    ["first_course", "second_course", "side", "salad", "dessert"]
  );
  assert.deepEqual(
    DISH_FIELDS.map((d) => d.label),
    ["Primer Plato", "Segundo Plato", "Guarnición", "Ensalada", "Postre"]
  );
});

test("formatSchoolKey formats and sorts school IDs with pipe delimiter", () => {
  assert.equal(formatSchoolKey([]), "");
  assert.equal(formatSchoolKey(["school-1"]), "school-1");
  assert.equal(formatSchoolKey(["school-b", "school-a"]), "school-a|school-b");
  assert.equal(
    formatSchoolKey(["school-c", "school-a", "school-b"]),
    "school-a|school-b|school-c"
  );

  // Immutability check
  const original = ["z", "a", "m"];
  const formatted = formatSchoolKey(original);
  assert.equal(formatted, "a|m|z");
  assert.deepEqual(original, ["z", "a", "m"], "Original array must not be mutated");
});

test("formatAllergenKey formats and sorts allergen names with plus delimiter", () => {
  assert.equal(formatAllergenKey([]), "");
  assert.equal(formatAllergenKey(["Gluten"]), "Gluten");
  assert.equal(formatAllergenKey(["Lactosa", "Gluten"]), "Gluten + Lactosa");
  assert.equal(
    formatAllergenKey(["Pescado", "Huevo", "Frutos secos"]),
    "Frutos secos + Huevo + Pescado"
  );

  // Immutability check
  const original = ["Soja", "Apio"];
  const formatted = formatAllergenKey(original);
  assert.equal(formatted, "Apio + Soja");
  assert.deepEqual(original, ["Soja", "Apio"], "Original array must not be mutated");
});

test("groupChildrenByAllergenKey groups children by canonical allergen combo", () => {
  const children = [
    {
      id: "c1",
      first_name: "Marc",
      last_name: "García",
      allergens: [{ name: "Lactosa" }, { name: "Gluten" }],
    },
    {
      id: "c2",
      first_name: "Laura",
      last_name: "Pérez",
      allergens: [{ name: "Gluten" }, { name: "Lactosa" }],
    },
    {
      id: "c3",
      first_name: "Pau",
      last_name: "Roca",
      allergens: [{ name: "Gluten" }],
    },
  ];

  const grouped = groupChildrenByAllergenKey(children);

  assert.equal(grouped.size, 2);
  assert.ok(grouped.has("Gluten + Lactosa"));
  assert.ok(grouped.has("Gluten"));

  const comboChildren = grouped.get("Gluten + Lactosa");
  assert.equal(comboChildren.length, 2);
  assert.equal(comboChildren[0].id, "c1");
  assert.equal(comboChildren[1].id, "c2");

  const glutenChildren = grouped.get("Gluten");
  assert.equal(glutenChildren.length, 1);
  assert.equal(glutenChildren[0].id, "c3");

  // Empty list returns empty map
  assert.equal(groupChildrenByAllergenKey([]).size, 0);
});

test("detectChangedDishes returns empty array when base and variant have identical dishes", () => {
  const base = {
    first_course: "Lentejas",
    second_course: "Pollo",
    side: "Arroz",
    salad: "Lechuga",
    dessert: "Manzana",
  };
  const variant = { ...base };

  const changed = detectChangedDishes(base, variant);
  assert.deepEqual(changed, []);
});

test("detectChangedDishes detects single and multiple changed dishes", () => {
  const base = {
    first_course: "Lentejas",
    second_course: "Merluza",
    side: "Arroz",
    salad: "Tomate",
    dessert: "Plátano",
  };
  const variant = {
    first_course: "Lentejas sin chorizo",
    second_course: "Merluza plancha",
    side: "Arroz",
    salad: "Tomate",
    dessert: "Plátano",
  };

  const changed = detectChangedDishes(base, variant);
  assert.deepEqual(changed, [
    { field: "first_course", label: "Primer Plato", value: "Lentejas sin chorizo" },
    { field: "second_course", label: "Segundo Plato", value: "Merluza plancha" },
  ]);
});

test("detectChangedDishes handles whitespace trimming and missing dishes", () => {
  const base = {
    first_course: "Arroz ",
    second_course: "Pollo",
    side: null,
    salad: "",
    dessert: "Yogur",
  };
  const variant = {
    first_course: " Arroz",
    second_course: "", // Base had Pollo, variant is empty -> '—'
    side: undefined, // both null/undefined -> no change
    salad: "  ", // both empty/spaces -> no change
    dessert: "Fruta",
  };

  const changed = detectChangedDishes(base, variant);
  assert.deepEqual(changed, [
    { field: "second_course", label: "Segundo Plato", value: "—" },
    { field: "dessert", label: "Postre", value: "Fruta" },
  ]);
});

test("pairBaseMenusWithVariants pairs variants with matching schoolKey", () => {
  const bases = [
    {
      menu: {
        id: "base-1",
        type: "normal",
        first_course: "Macarrones",
        second_course: "Ternera",
        side: "Patatas",
        salad: "Mixta",
        dessert: "Pera",
      },
      schools: [{ id: "sch-1", name: "Escola 1" }, { id: "sch-2", name: "Escola 2" }],
      schoolIds: ["sch-1", "sch-2"],
    },
  ];

  const specials = [
    {
      menu: {
        id: "spec-1",
        type: "sin-gluten",
        first_course: "Macarrones sin gluten",
        second_course: "Ternera",
        side: "Patatas",
        salad: "Mixta",
        dessert: "Pera",
      },
      schools: [{ id: "sch-2", name: "Escola 2" }, { id: "sch-1", name: "Escola 1" }],
      schoolIds: ["sch-2", "sch-1"], // Unordered schoolIds match same baseKey
    },
  ];

  const childrenByCombo = new Map([
    [
      "sin-gluten",
      [
        {
          id: "child-1",
          first_name: "Nil",
          last_name: "Soler",
          className: "1A",
          schoolName: "Escola 1",
        },
      ],
    ],
  ]);

  const result = pairBaseMenusWithVariants(bases, specials, childrenByCombo);

  assert.equal(result.length, 1);
  assert.equal(result[0].menu.id, "base-1");
  assert.ok(result[0].variants, "Base menu should have variants");
  assert.equal(result[0].variants.length, 1);

  const variant = result[0].variants[0];
  assert.equal(variant.id, "spec-1");
  assert.equal(variant.type, "sin-gluten");
  assert.deepEqual(variant.children, [
    {
      id: "child-1",
      first_name: "Nil",
      last_name: "Soler",
      className: "1A",
      schoolName: "Escola 1",
    },
  ]);
  assert.deepEqual(variant.changed, [
    { field: "first_course", label: "Primer Plato", value: "Macarrones sin gluten" },
  ]);
});

test("pairBaseMenusWithVariants does not match variant when schoolIds differ", () => {
  const bases = [
    {
      menu: {
        id: "base-1",
        type: "normal",
        first_course: "Sopa",
        second_course: "Pescado",
        side: "Pan",
        salad: "",
        dessert: "Naranja",
      },
      schools: [{ id: "sch-1", name: "Escola 1" }],
      schoolIds: ["sch-1"],
    },
  ];

  const specials = [
    {
      menu: {
        id: "spec-orphan",
        type: "vegetariano",
        first_course: "Sopa",
        second_course: "Tofu",
        side: "Pan",
        salad: "",
        dessert: "Naranja",
      },
      schools: [{ id: "sch-2", name: "Escola 2" }],
      schoolIds: ["sch-2"], // Different schoolIds -> does not pair with base-1
    },
  ];

  const result = pairBaseMenusWithVariants(bases, specials, new Map());

  // Base 1 has no variants attached
  assert.equal(result.length, 2);
  assert.equal(result[0].menu.id, "base-1");
  assert.equal(result[0].variants, undefined);

  // Orphan special is retained at the end of the array
  assert.equal(result[1].menu.id, "spec-orphan");
});

test("pairBaseMenusWithVariants handles multiple bases and multiple variants", () => {
  const bases = [
    {
      menu: {
        id: "b1",
        type: "normal",
        first_course: "Crema de calabaza",
        second_course: "Hamburguesa",
        side: "Ensalada",
        salad: "",
        dessert: "Fruta",
      },
      schools: [{ id: "s1" }],
      schoolIds: ["s1"],
    },
    {
      menu: {
        id: "b2",
        type: "normal",
        first_course: "Arroz con tomate",
        second_course: "Tortilla",
        side: "",
        salad: "",
        dessert: "Yogur",
      },
      schools: [{ id: "s2" }],
      schoolIds: ["s2"],
    },
  ];

  const specials = [
    {
      menu: {
        id: "s-b1-vegan",
        type: "vegetariano",
        first_course: "Crema de calabaza",
        second_course: "Hamburguesa vegetal",
        side: "Ensalada",
        salad: "",
        dessert: "Fruta",
      },
      schools: [{ id: "s1" }],
      schoolIds: ["s1"],
    },
    {
      menu: {
        id: "s-b2-gluten",
        type: "sin-gluten",
        first_course: "Arroz con tomate",
        second_course: "Tortilla",
        side: "",
        salad: "",
        dessert: "Yogur sin gluten",
      },
      schools: [{ id: "s2" }],
      schoolIds: ["s2"],
    },
  ];

  const result = pairBaseMenusWithVariants(bases, specials, new Map());

  assert.equal(result.length, 2);
  assert.equal(result[0].variants?.length, 1);
  assert.equal(result[0].variants[0].id, "s-b1-vegan");
  assert.equal(result[1].variants?.length, 1);
  assert.equal(result[1].variants[0].id, "s-b2-gluten");
});

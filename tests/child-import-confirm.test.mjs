import assert from "node:assert/strict";
import test from "node:test";
import {
  buildErrorReportTable,
  collectRowsToInsert,
  ERROR_REPORT_HEADERS,
  validateChildImportRows,
} from "../src/lib/child-import.ts";

const classes = [
  { id: "class-1", name: "Aula A1" },
  { id: "class-2", name: "Pájaros" },
];

const row = (overrides = {}) => ({
  excelRowNumber: 2,
  nombre: "Ana",
  apellidos: "García López",
  aula: "Aula A1",
  ...overrides,
});

// --- Paso 3: solo las filas ok se insertan (parcial insert-only) ---

test("collectRowsToInsert devuelve solo las filas ok con su classId", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2 }),
      row({ excelRowNumber: 3, nombre: "", apellidos: "Pérez", aula: "Aula A1" }),
      row({ excelRowNumber: 4, nombre: "Leo", apellidos: "Pérez", aula: "Aula A1" }),
      row({ excelRowNumber: 5, nombre: "Ana", apellidos: "García López", aula: "Aula A1" }),
    ],
    classes,
    existingChildren: [],
  });

  const toInsert = collectRowsToInsert(result.verdicts);
  assert.equal(toInsert.length, 2);
  assert.equal(toInsert[0].excelRowNumber, 2);
  assert.equal(toInsert[0].first_name, "Ana");
  assert.equal(toInsert[0].last_name, "García López");
  assert.equal(toInsert[0].class_id, "class-1");
  assert.equal(toInsert[1].first_name, "Leo");
});

test("collectRowsToInsert omite duplicados contra BD sin sobrescribir", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2, nombre: "Ana", apellidos: "García", aula: "Aula A1" }),
      row({ excelRowNumber: 3, nombre: "Leo", apellidos: "Pérez", aula: "Aula A1" }),
    ],
    classes,
    existingChildren: [{ first_name: "Ana", last_name: "García", class_id: "class-1" }],
  });

  const toInsert = collectRowsToInsert(result.verdicts);
  assert.equal(toInsert.length, 1);
  assert.equal(toInsert[0].first_name, "Leo");
});

test("collectRowsToInsert con cero ok devuelve lista vacía", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 2, nombre: "", apellidos: "", aula: "" })],
    classes,
    existingChildren: [],
  });

  assert.deepEqual(collectRowsToInsert(result.verdicts), []);
});

// --- Reporte .xlsx: tabla pura (cabecera + líneas + resumen) ---

test("ERROR_REPORT_HEADERS usa las 7 columnas canónicas en español", () => {
  assert.deepEqual(ERROR_REPORT_HEADERS, [
    "n_fila_excel",
    "nombre",
    "apellidos",
    "aula",
    "campo",
    "valor_original",
    "motivo_error",
  ]);
});

test("buildErrorReportTable genera una línea por error con nº de fila real", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 9, nombre: "", apellidos: "Pérez", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  const table = buildErrorReportTable(result);
  assert.deepEqual(table[0], ERROR_REPORT_HEADERS);
  assert.equal(table[1][0], 9);
  assert.equal(table[1][4], "nombre");
  assert.ok(String(table[1][6]).length > 0);
});

test("buildErrorReportTable genera dos líneas para una fila con dos errores", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 6, nombre: "", apellidos: "", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  const table = buildErrorReportTable(result);
  // cabecera + 2 líneas de error + fila en blanco + bloque resumen
  const dataRows = table.slice(1, 3);
  assert.equal(dataRows.length, 2);
  assert.ok(dataRows.every((r) => r[0] === 6));
});

test("buildErrorReportTable incluye el resumen total/listos/errores/duplicados", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2 }),
      row({ excelRowNumber: 3, nombre: "", apellidos: "Pérez", aula: "Aula A1" }),
      row({ excelRowNumber: 4, nombre: "Ana", apellidos: "García López", aula: "Aula A1" }),
    ],
    classes,
    existingChildren: [],
  });

  const table = buildErrorReportTable(result);
  const flat = table.map((r) => String(r[0]));
  assert.ok(flat.some((cell) => cell.includes("total")));
  assert.ok(flat.some((cell) => cell.includes("listos")));
  assert.ok(flat.some((cell) => cell.includes("con error")));
  assert.ok(flat.some((cell) => cell.includes("duplicad")));
});

test("buildErrorReportTable sin errores solo deja cabecera + resumen", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 2 })],
    classes,
    existingChildren: [],
  });

  const table = buildErrorReportTable(result);
  assert.deepEqual(table[0], ERROR_REPORT_HEADERS);
  // Sin líneas de error: cabecera + fila en blanco + resumen
  assert.ok(table.length >= 2);
  const flat = table.map((r) => String(r[0]));
  assert.ok(flat.some((cell) => cell.includes("total")));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_IMPORT_ROWS,
  buildErrorReportRows,
  mapHeaderToField,
  normalizeText,
  validateChildImportRows,
  validateImportHeaders,
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

// --- Normalización canónica: trim + lowercase + sin tildes ---

test("normalizeText aplica trim, minúsculas y quita tildes", () => {
  assert.equal(normalizeText("  Árbol  "), "arbol");
  assert.equal(normalizeText("GARCÍA"), "garcia");
  assert.equal(normalizeText("  Aula A1 "), "aula a1");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeText(undefined), "");
});

test("las cabeceras se normalizan: Nombre / NOMBRE / nombre valen igual", () => {
  assert.equal(mapHeaderToField("Nombre"), "nombre");
  assert.equal(mapHeaderToField("  NOMBRE "), "nombre");
  assert.equal(mapHeaderToField("Apellidos"), "apellidos");
  assert.equal(mapHeaderToField("APELLIDOS"), "apellidos");
  assert.equal(mapHeaderToField("Aula"), "aula");
  assert.equal(mapHeaderToField(" AULA "), "aula");
});

test("las columnas extra se ignoran sin bloquear", () => {
  assert.equal(mapHeaderToField("edad"), null);
  assert.equal(mapHeaderToField("observaciones"), null);
  const headers = validateImportHeaders(["nombre", "apellidos", "aula", "edad"]);
  assert.equal(headers.ok, true);
  assert.deepEqual(headers.missing, []);
});

test("se exigen las 3 cabeceras presentes", () => {
  const headers = validateImportHeaders(["nombre", "apellidos"]);
  assert.equal(headers.ok, false);
  assert.deepEqual(headers.missing, ["aula"]);
});

// --- Filas vacías ---

test("las filas totalmente vacías se ignoran en silencio", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2 }),
      { excelRowNumber: 3, nombre: "  ", apellidos: "", aula: " " },
      row({ excelRowNumber: 4, nombre: "Leo", apellidos: "Pérez", aula: "Aula A1" }),
    ],
    classes,
    existingChildren: [],
  });

  assert.equal(result.verdicts[1].estado, "vacia");
  assert.equal(result.summary.vacias, 1);
  assert.equal(result.summary.conError, 0);
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.listos, 2);
});

test("el valor original del reporte conserva el texto sin recortar", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 3, nombre: "   ", apellidos: "Pérez", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  const report = buildErrorReportRows(result);
  assert.equal(report[0].valorOriginal, "   ");
});

// --- Obligatorios ---

test("nombre, apellidos y aula son obligatorios por fila", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 5, nombre: " ", apellidos: "Pérez", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  assert.equal(result.verdicts[0].estado, "error");
  const campos = result.verdicts[0].errores.map((e) => e.campo);
  assert.ok(campos.includes("nombre"));
});

test("una fila con dos campos vacíos genera dos líneas de reporte", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 6, nombre: "", apellidos: "", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  const report = buildErrorReportRows(result);
  assert.equal(report.length, 2);
});

// --- Aula ---

test("el aula se resuelve por nombre normalizado dentro del colegio", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 2, aula: "  PÁJAROS " })],
    classes,
    existingChildren: [],
  });

  assert.equal(result.verdicts[0].estado, "ok");
  assert.equal(result.verdicts[0].classId, "class-2");
});

test("un aula inexistente marca error con motivo claro y valor original", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 7, aula: "Aula Z99" })],
    classes,
    existingChildren: [],
  });

  assert.equal(result.verdicts[0].estado, "error");
  const err = result.verdicts[0].errores[0];
  assert.equal(err.campo, "aula");
  assert.equal(err.valorOriginal, "Aula Z99");
  assert.match(err.motivo, /no existe/);
});

// --- Duplicados ---

test("los duplicados dentro del fichero se detectan por clave normalizada", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2, nombre: "Ana", apellidos: "García", aula: "Aula A1" }),
      row({ excelRowNumber: 3, nombre: "  ANA ", apellidos: "garcia", aula: "aula a1" }),
    ],
    classes,
    existingChildren: [],
  });

  assert.equal(result.verdicts[0].estado, "ok");
  assert.equal(result.verdicts[1].estado, "duplicado");
  assert.match(result.verdicts[1].motivo, /duplicad/i);
});

test("los duplicados contra la BD usan el mismo criterio normalizado", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 2, nombre: "ANA", apellidos: "García López", aula: "aula a1" })],
    classes,
    existingChildren: [{ first_name: "Ana", last_name: "Garcia Lopez", class_id: "class-1" }],
  });

  assert.equal(result.verdicts[0].estado, "duplicado");
});

test("un duplicado contra la BD con aula distinta no colisiona", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 2, nombre: "Ana", apellidos: "García López", aula: "Pájaros" })],
    classes,
    existingChildren: [{ first_name: "Ana", last_name: "García López", class_id: "class-1" }],
  });

  assert.equal(result.verdicts[0].estado, "ok");
});

test("la importación es insert-only: los duplicados se omiten sin sobrescribir", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2, nombre: "Ana", apellidos: "García", aula: "Aula A1" }),
      row({ excelRowNumber: 3, nombre: "Leo", apellidos: "Pérez", aula: "Aula A1" }),
    ],
    classes,
    existingChildren: [{ first_name: "Ana", last_name: "García", class_id: "class-1" }],
  });

  const listos = result.verdicts.filter((v) => v.estado === "ok");
  assert.equal(listos.length, 1);
  assert.equal(listos[0].nombre, "Leo");
});

// --- Previsualización y reporte ---

test("la previsualización informa total / listos / con error con motivo por fila", () => {
  const result = validateChildImportRows({
    rows: [
      row({ excelRowNumber: 2 }),
      row({ excelRowNumber: 3, nombre: "", apellidos: "Pérez", aula: "Aula A1" }),
      row({ excelRowNumber: 4, aula: "Aula Z99" }),
    ],
    classes,
    existingChildren: [],
  });

  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.listos, 1);
  assert.equal(result.summary.conError, 2);
});

test("el reporte de errores usa el nº de fila real e incluye campo y valor original", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 9, nombre: "", apellidos: "Pérez", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  const report = buildErrorReportRows(result);
  assert.equal(report.length, 1);
  assert.equal(report[0].filaExcel, 9);
  assert.equal(report[0].campo, "nombre");
  assert.equal(report[0].nombre, "");
  assert.ok(report[0].motivo.length > 0);
});

test("los mensajes de error están en español e indican campo y valor", () => {
  const result = validateChildImportRows({
    rows: [row({ excelRowNumber: 2, nombre: "", apellidos: "Pérez", aula: "Aula A1" })],
    classes,
    existingChildren: [],
  });

  const report = buildErrorReportRows(result);
  assert.match(report[0].motivo, /nombre/i);
});

// --- Límite ---

test("el límite es de 1000 filas por fichero con aviso claro", () => {
  assert.equal(MAX_IMPORT_ROWS, 1000);
  const rows = Array.from({ length: 1001 }, (_, i) =>
    row({ excelRowNumber: i + 2, nombre: `Nombre${i}`, apellidos: "Pérez", aula: "Aula A1" }),
  );
  const result = validateChildImportRows({ rows, classes, existingChildren: [] });
  assert.equal(result.excedeLimite, true);
  assert.match(result.mensajeLimite, /1000/);
});

test("1000 filas no exceden el límite", () => {
  const rows = Array.from({ length: 1000 }, (_, i) =>
    row({ excelRowNumber: i + 2, nombre: `Nombre${i}`, apellidos: "Pérez", aula: "Aula A1" }),
  );
  const result = validateChildImportRows({ rows, classes, existingChildren: [] });
  assert.equal(result.excedeLimite, false);
});

test("la validación no muta sus entradas", () => {
  const rows = [row({ excelRowNumber: 2 })];
  const snapshot = JSON.parse(JSON.stringify(rows));
  validateChildImportRows({ rows, classes, existingChildren: [] });
  assert.deepEqual(rows, snapshot);
});

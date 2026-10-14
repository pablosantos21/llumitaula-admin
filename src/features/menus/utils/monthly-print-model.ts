export type PrintMenu = {
  type: string;
  first_course?: string | null;
  second_course?: string | null;
  side?: string | null;
  salad?: string | null;
  dessert?: string | null;
};

export type PrintMenuAssignment = { menu: PrintMenu };

export type PrintDish = { label: string; value: string };
export type MonthlyPrintDay = {
  date: string;
  dayNumber: number;
  isServiceDay: boolean;
  notice: "Sin servicio" | null;
  base: PrintDish[];
  variants: { label: string; dishes: PrintDish[] }[];
};

const DISH_FIELDS = [
  ["first_course", "Primero"],
  ["second_course", "Segundo"],
  ["side", "Guarnición"],
  ["salad", "Ensalada"],
  ["dessert", "Postre"],
] as const;

function dishes(menu: PrintMenu | undefined): PrintDish[] {
  if (!menu) return [];
  return DISH_FIELDS.flatMap(([field, label]) => {
    const value = menu[field]?.trim() ?? "";
    return value ? [{ label, value }] : [];
  });
}

export function buildMonthlyPrintModel(
  year: number,
  month: number,
  assignmentsByDate: Record<string, PrintMenuAssignment[]>,
) {
  const days: MonthlyPrintDay[] = [];
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let dayNumber = 1; dayNumber <= lastDay; dayNumber += 1) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
    const weekday = new Date(year, month, dayNumber).getDay();
    if (weekday === 0 || weekday === 6) continue;

    const menus = assignmentsByDate[date] ?? [];
    const baseMenu = menus.find(({ menu }) => menu.type === "normal")?.menu;
    const isServiceDay = menus.length > 0;
    days.push({
      date,
      dayNumber,
      isServiceDay,
      notice: isServiceDay ? null : "Sin servicio",
      base: dishes(baseMenu),
      variants: menus
        .filter(({ menu }) => menu.type !== "normal")
        .map(({ menu }) => ({ label: menu.type, dishes: dishes(menu) })),
    });
  }

  return { year, month, days };
}

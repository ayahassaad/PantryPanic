"use client";

import { useState } from "react";
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_LABELS,
} from "@pantry-panic/shared";

// Each row's four fields share one name ("ingredientName", etc.) across
// all rows — formData.getAll("ingredientName") then comes back as a plain
// array in row order, same for the other three fields, so the server
// action can zip them back together by index without any JSON encoding.
interface Row {
  key: number;
  quantity: string;
  unit: string;
  name: string;
  category: string;
}

let nextKey = 0;
function emptyRow(): Row {
  return { key: nextKey++, quantity: "", unit: "", name: "", category: "pantry" };
}

export interface IngredientRowInput {
  quantity: string;
  unit: string;
  name: string;
  category: string;
}

const FIELD_CLASSES =
  "rounded-lg border-2 border-ink-faint bg-cream-card px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink";

export function IngredientRows({ initialRows }: { initialRows?: IngredientRowInput[] }) {
  // On the edit form this comes pre-filled with the recipe's existing
  // ingredients; on "new" it's left undefined and starts as one blank
  // row, same as before.
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows && initialRows.length > 0
      ? initialRows.map((row) => ({ key: nextKey++, ...row }))
      : [emptyRow()],
  );

  function updateRow(key: number, field: keyof Omit<Row, "key">, value: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 text-xs font-bold text-ink-faint">
        <span className="w-16">Qty</span>
        <span className="w-20">Unit</span>
        <span className="flex-1">Ingredient</span>
        <span className="w-36">Aisle</span>
        <span className="w-5" />
      </div>
      {rows.map((row) => (
        <div key={row.key} className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={row.quantity}
            onChange={(event) => updateRow(row.key, "quantity", event.target.value)}
            placeholder="2"
            name="ingredientQuantity"
            className={`w-16 ${FIELD_CLASSES}`}
          />
          <input
            type="text"
            value={row.unit}
            onChange={(event) => updateRow(row.key, "unit", event.target.value)}
            placeholder="cups"
            name="ingredientUnit"
            className={`w-20 ${FIELD_CLASSES}`}
          />
          <input
            type="text"
            value={row.name}
            onChange={(event) => updateRow(row.key, "name", event.target.value)}
            placeholder="flour"
            name="ingredientName"
            className={`flex-1 ${FIELD_CLASSES}`}
          />
          <select
            value={row.category}
            onChange={(event) => updateRow(row.key, "category", event.target.value)}
            name="ingredientCategory"
            className={`w-36 ${FIELD_CLASSES}`}
          >
            {INGREDIENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {INGREDIENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => removeRow(row.key)}
            aria-label="Remove ingredient"
            className="w-5 flex-none font-bold text-ink-faint hover:text-tomato-600"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="w-fit rounded-lg border-2 border-ink bg-cream-deep px-3 py-1.5 font-display text-sm font-semibold text-ink transition hover:bg-cream"
      >
        + Add ingredient
      </button>
    </div>
  );
}

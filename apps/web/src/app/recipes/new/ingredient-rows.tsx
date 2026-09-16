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

export function IngredientRows() {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  function updateRow(key: number, field: keyof Omit<Row, "key">, value: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 text-xs text-neutral-500">
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
            className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-basil-600"
          />
          <input
            type="text"
            value={row.unit}
            onChange={(event) => updateRow(row.key, "unit", event.target.value)}
            placeholder="cups"
            name="ingredientUnit"
            className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-basil-600"
          />
          <input
            type="text"
            value={row.name}
            onChange={(event) => updateRow(row.key, "name", event.target.value)}
            placeholder="flour"
            name="ingredientName"
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-basil-600"
          />
          <select
            value={row.category}
            onChange={(event) => updateRow(row.key, "category", event.target.value)}
            name="ingredientCategory"
            className="w-36 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-basil-600"
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
            className="w-5 flex-none text-neutral-400 hover:text-neutral-600"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
      >
        + Add ingredient
      </button>
    </div>
  );
}

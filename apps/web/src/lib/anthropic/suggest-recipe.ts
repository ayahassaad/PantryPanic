import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  INGREDIENT_CATEGORIES,
  RecipeSuggestionSchema,
  type RecipeSuggestion,
  type RecipeSuggestionInput,
} from "@pantry-panic/shared";

// Keep the model configurable without a redeploy — bump ANTHROPIC_MODEL in
// the environment if a newer Claude model should be used.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export class MissingApiKeyError extends Error {}
export class RecipeSuggestionUpstreamError extends Error {}

// Shared by both tool schemas below (single suggestion and the
// fill-a-week batch) — one recipe's shape, described once. Must stay in
// sync with RecipeSuggestionSchema in packages/shared.
const RECIPE_ITEM_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string", description: "Short, appetizing recipe name." },
    description: {
      type: "string",
      description: "One or two sentence description of the dish.",
    },
    ingredients: {
      type: "array",
      description:
        "Every ingredient the recipe needs — both from the user's pantry list and anything extra.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "e.g. \"garlic\", not \"2 cloves garlic\"." },
          quantity: {
            type: "number",
            description:
              "A countable/measurable amount, e.g. 2 for \"2 cloves garlic\". Omit entirely for things like \"salt to taste\" that don't have one.",
          },
          unit: {
            type: "string",
            description: "e.g. \"cloves\", \"cups\", \"g\". Omit if quantity is omitted.",
          },
          category: {
            type: "string",
            enum: [...INGREDIENT_CATEGORIES],
            description: "Which grocery aisle this ingredient belongs in.",
          },
        },
        required: ["name", "category"],
      },
    },
    steps: {
      type: "array",
      items: { type: "string" },
      description: "Ordered cooking steps.",
    },
  },
  required: ["title", "description", "ingredients", "steps"],
};

// The response schema handed to Claude as a tool call, so we get back
// well-formed JSON instead of having to parse it out of prose.
const SUGGEST_RECIPE_TOOL: Anthropic.Tool = {
  name: "suggest_recipe",
  description: "Return a single recipe suggestion as structured data.",
  input_schema: RECIPE_ITEM_SCHEMA,
};

function buildPrompt(input: RecipeSuggestionInput): string {
  const lines = [
    `Pantry ingredients on hand: ${input.ingredients.join(", ")}.`,
    input.mealSlot ? `Meal: ${input.mealSlot}.` : null,
    input.constraints ? `Constraints: ${input.constraints}.` : null,
    "",
    "Suggest one recipe that makes the best use of the pantry ingredients above.",
    "It's fine to call for a small number of additional common ingredients " +
      "(salt, oil, spices, etc.) if needed, but prefer recipes that lean on " +
      "what's already on hand. Give each ingredient its own quantity, unit, " +
      "and grocery-aisle category so it can be combined into a shopping " +
      "list later. Call the suggest_recipe tool with the result.",
  ];
  return lines.filter((line) => line !== null).join("\n");
}

/**
 * Ask Claude for one recipe suggestion built around the given pantry
 * ingredients. Returns the parsed recipe plus the exact prompt used, so
 * callers can stash the prompt in recipes.ai_prompt for provenance.
 *
 * Throws MissingApiKeyError if ANTHROPIC_API_KEY isn't set, or
 * RecipeSuggestionUpstreamError if the API call fails or returns something
 * that doesn't match the expected shape.
 */
export async function generateRecipeSuggestion(
  input: RecipeSuggestionInput,
): Promise<{ recipe: RecipeSuggestion; prompt: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError(
      "ANTHROPIC_API_KEY is not set. Add it to apps/web/.env.local.",
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(input);

  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [SUGGEST_RECIPE_TOOL],
      tool_choice: { type: "tool", name: "suggest_recipe" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw new RecipeSuggestionUpstreamError(
      "Couldn't reach the recipe suggestion service. Try again shortly.",
      { cause: error },
    );
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new RecipeSuggestionUpstreamError(
      "Got an unexpected response while suggesting a recipe.",
    );
  }

  const parsed = RecipeSuggestionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    // Node's default console depth hides anything nested more than two
    // levels deep — printed as "[Object]" — which is exactly where the
    // useful part of a Zod error lives (the issue list, and the raw value
    // that failed). Some log viewers (Vercel included) also render a
    // multi-argument console.error as a collapsible structured object
    // rather than plain text, which loses the detail again on copy/paste.
    // Joining everything into ONE plain string sidesteps both: there's
    // nothing left for either layer to fold away.
    console.error(
      [
        "[suggest-recipe] suggest_recipe response failed validation:",
        JSON.stringify(parsed.error.issues, null, 2),
        "Raw input:",
        JSON.stringify(toolUse.input, null, 2),
      ].join("\n"),
    );
    throw new RecipeSuggestionUpstreamError(
      "Got a malformed recipe suggestion. Try again.",
      { cause: parsed.error },
    );
  }

  return { recipe: parsed.data, prompt };
}

// Batch version of SUGGEST_RECIPE_TOOL — one call, one array back, instead
// of one Claude request per empty meal box. Filling a mostly-empty week is
// naturally 10-20 slots; calling generateRecipeSuggestion in a loop that
// many times would both hammer the per-user rate limit meant for one
// suggestion at a time and be needlessly slow/expensive for what's really
// one request ("plan my week") from the user's point of view.
const FILL_WEEK_TOOL: Anthropic.Tool = {
  name: "fill_week",
  description:
    "Return one recipe suggestion for every requested meal slot, as an array in the exact same order the slots were listed.",
  input_schema: {
    type: "object",
    properties: {
      recipes: {
        type: "array",
        description: "One recipe per requested slot, in the same order as the slot list.",
        items: RECIPE_ITEM_SCHEMA,
      },
    },
    required: ["recipes"],
  },
};

const WeekSuggestionSchema = z.object({
  recipes: z.array(RecipeSuggestionSchema).min(1),
});

export interface WeekSuggestionInput {
  // e.g. ["Monday breakfast", "Monday dinner", "Tuesday lunch", ...] — the
  // caller (fillWeekWithAi) already knows which slots are empty and in
  // what order it wants the response back, so that ordering is handed in
  // as plain labels rather than this module knowing about MealSlot/dates.
  slotLabels: string[];
  ingredients: string[];
  constraints?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
  unitSystem?: "metric" | "imperial";
}

function buildWeekPrompt(input: WeekSuggestionInput): string {
  const lines = [
    input.ingredients.length > 0
      ? `Pantry ingredients on hand: ${input.ingredients.join(", ")}.`
      : "No specific pantry ingredients were given — use your judgment for a varied, approachable week of home cooking.",
    input.constraints ? `Constraints: ${input.constraints}.` : null,
    input.dietaryPreferences?.length
      ? `Dietary preferences: ${input.dietaryPreferences.join(", ")}.`
      : null,
    input.allergies?.length
      ? `Allergies/exclusions (hard constraint, never include these): ${input.allergies.join(", ")}.`
      : null,
    "",
    `Suggest a recipe for each of these ${input.slotLabels.length} meal slots, in this exact order:`,
    ...input.slotLabels.map((label, i) => `${i + 1}. ${label}`),
    "",
    "Aim for variety across the week — avoid suggesting the same or a near-identical " +
      "dish twice unless the pantry list is narrow enough that repeats genuinely make " +
      "sense. Where it's natural, let ingredients carry across a few meals so the " +
      "resulting shopping list isn't needlessly scattered (e.g. a bunch of herbs used " +
      "twice rather than bought for one meal and wasted). Give each ingredient its own " +
      "quantity, unit, and grocery-aisle category. Call the fill_week tool with exactly " +
      `${input.slotLabels.length} recipes, one per slot, in the order listed above.`,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

/**
 * Ask Claude for a whole batch of recipe suggestions in one call — one per
 * entry in input.slotLabels, returned in that same order. Used by "fill
 * the week" rather than looping generateRecipeSuggestion once per empty
 * box (see the comment on FILL_WEEK_TOOL above for why).
 *
 * Throws MissingApiKeyError if ANTHROPIC_API_KEY isn't set, or
 * RecipeSuggestionUpstreamError if the API call fails or returns something
 * that doesn't match the expected shape. Note: the returned array's length
 * isn't guaranteed to exactly match slotLabels.length — Claude usually
 * gets this right but callers should zip by index defensively and handle
 * a short (or, in principle, long) result rather than assuming it lines
 * up 1:1.
 */
export async function generateWeekSuggestions(
  input: WeekSuggestionInput,
): Promise<{ recipes: RecipeSuggestion[]; prompt: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError(
      "ANTHROPIC_API_KEY is not set. Add it to apps/web/.env.local.",
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildWeekPrompt(input);
  // One recipe (title + description + a real ingredient list + steps)
  // gets a flat 1024 tokens in generateRecipeSuggestion above and that's
  // reliable, so budget the same 1024/recipe here rather than a lower
  // per-slot rate — the previous formula (600 base + 350/slot) gave a
  // single-slot request only 950 tokens total, LESS than what one recipe
  // alone gets on the non-batch path, and cut it off almost immediately.
  // Capped at 8192 (this model's practical output ceiling), which lines
  // up with MAX_SELECTED_SLOTS = 8 in fill-week-constants.ts — the
  // largest batch this ever has to cover.
  const maxTokens = Math.min(8192, input.slotLabels.length * 1024);

  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      tools: [FILL_WEEK_TOOL],
      tool_choice: { type: "tool", name: "fill_week" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    throw new RecipeSuggestionUpstreamError(
      "Couldn't reach the recipe suggestion service. Try again shortly.",
      { cause: error },
    );
  }

  if (message.stop_reason === "max_tokens") {
    // The response got cut off mid-generation — Claude's tool_use.input
    // ends up incomplete JSON in this case, which fails the schema check
    // below in a way that's indistinguishable from Claude just getting the
    // shape wrong. Catching it here by stop_reason instead gives a much
    // more useful error (and points straight at "ask for fewer at once"
    // instead of "try again" for the same failure).
    console.error(
      `[suggest-recipe] fill_week response hit max_tokens (slotCount=${input.slotLabels.length}, maxTokens=${maxTokens})`,
    );
    throw new RecipeSuggestionUpstreamError(
      "That batch of suggestions was too large and got cut off. Try again with fewer empty slots at once.",
    );
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new RecipeSuggestionUpstreamError(
      "Got an unexpected response while filling the week.",
    );
  }

  const parsed = WeekSuggestionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    // Same reasoning as generateRecipeSuggestion's log above — one joined
    // plain string so neither Node's inspect depth nor a log viewer's own
    // object-collapsing UI can hide the issue list or the raw payload.
    console.error(
      [
        "[suggest-recipe] fill_week response failed validation:",
        JSON.stringify(parsed.error.issues, null, 2),
        "Raw input:",
        JSON.stringify(toolUse.input, null, 2),
      ].join("\n"),
    );
    throw new RecipeSuggestionUpstreamError(
      "Got a malformed batch of recipe suggestions. Try again.",
      { cause: parsed.error },
    );
  }

  return { recipes: parsed.data.recipes, prompt };
}

import Anthropic from "@anthropic-ai/sdk";
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

// The response schema handed to Claude as a tool call, so we get back
// well-formed JSON instead of having to parse it out of prose. This must
// stay in sync with RecipeSuggestionSchema in packages/shared.
const SUGGEST_RECIPE_TOOL: Anthropic.Tool = {
  name: "suggest_recipe",
  description: "Return a single recipe suggestion as structured data.",
  input_schema: {
    type: "object",
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
  },
};

function buildPrompt(input: RecipeSuggestionInput): string {
  const lines = [
    `Pantry ingredients on hand: ${input.ingredients.join(", ")}.`,
    input.mealSlot ? `Meal: ${input.mealSlot}.` : null,
    input.constraints ? `Constraints: ${input.constraints}.` : null,
    input.dietaryPreferences?.length
      ? `Dietary preferences: ${input.dietaryPreferences.join(", ")}.`
      : null,
    // Phrased as its own hard, capitalized requirement rather than folded
    // into the preferences line above — an allergy is a safety issue, not
    // a taste preference, and shouldn't read like one to the model.
    input.allergies?.length
      ? `MUST NOT include any of the following allergens, in any form: ${input.allergies.join(", ")}. This is a hard requirement, not a preference.`
      : null,
    input.unitSystem === "metric"
      ? "Give ingredient quantities in metric units (g, kg, ml, l) rather than US customary units."
      : null,
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
    throw new RecipeSuggestionUpstreamError(
      "Got a malformed recipe suggestion. Try again.",
      { cause: parsed.error },
    );
  }

  return { recipe: parsed.data, prompt };
}

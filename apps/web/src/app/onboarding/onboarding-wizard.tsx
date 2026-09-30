"use client";

import { useState } from "react";
import { Mascot } from "@/components/mascot";
import { completeOnboarding, skipOnboarding } from "./actions";

const CUISINE_OPTIONS = [
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "Mediterranean",
  "French",
  "American",
  "Korean",
  "Middle Eastern",
  "Vietnamese",
  "Greek",
  "Spanish",
];

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Gluten-free",
  "Dairy-free",
  "Low-carb",
  "Keto",
  "Halal",
  "Kosher",
  "Paleo",
];

const ALLERGY_OPTIONS = [
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Fish",
  "Eggs",
  "Dairy",
  "Soy",
  "Wheat/gluten",
  "Sesame",
];

interface Step {
  key: "cuisine" | "dietary" | "allergies" | "household";
  eyebrow: string;
  title: string;
}

const STEPS: Step[] = [
  {
    key: "cuisine",
    eyebrow: "1 of 4",
    title: "What flavors are you into?",
  },
  {
    key: "dietary",
    eyebrow: "2 of 4",
    title: "Any dietary preferences?",
  },
  {
    key: "allergies",
    eyebrow: "3 of 4",
    title: "Any allergies we should know about?",
  },
  {
    key: "household",
    eyebrow: "4 of 4",
    title: "Last thing — set up your kitchen",
  },
];

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition ${
        active
          ? "border-ink bg-tomato-400 text-cream"
          : "border-ink-faint bg-cream-card text-ink-soft hover:border-ink-faint hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// Hidden inputs are how a plain <form action={serverAction}> (no fetch,
// no useTransition — same pattern as every other form in this app) gets
// an array value: the chips above are just buttons that flip React state,
// and this renders that state back out as one input per selected value so
// formData.getAll("cuisinePreferences") on the server sees the whole list.
function HiddenList({ name, values }: { name: string; values: string[] }) {
  return (
    <>
      {values.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

interface OnboardingWizardProps {
  initialCuisinePreferences: string[];
  initialDietaryPreferences: string[];
  initialAllergies: string[];
  initialHouseholdSize: number;
  initialUnitSystem: "metric" | "imperial";
}

export function OnboardingWizard({
  initialCuisinePreferences,
  initialDietaryPreferences,
  initialAllergies,
  initialHouseholdSize,
  initialUnitSystem,
}: OnboardingWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [cuisinePreferences, setCuisinePreferences] = useState(initialCuisinePreferences);
  const [dietaryPreferences, setDietaryPreferences] = useState(initialDietaryPreferences);
  const [allergies, setAllergies] = useState(initialAllergies);
  const [otherAllergy, setOtherAllergy] = useState("");
  const [householdSize, setHouseholdSize] = useState(initialHouseholdSize);
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">(initialUnitSystem);

  // stepIndex is only ever set via the clamped setStepIndex calls below
  // (Math.max/min against 0 and STEPS.length - 1), so it's always a valid
  // index into STEPS — the assertion just tells the compiler what those
  // clamps already guarantee at runtime (noUncheckedIndexedAccess can't
  // see through them).
  const step = STEPS[stepIndex]!;
  const isLastStep = stepIndex === STEPS.length - 1;

  // Folded in at submit time rather than kept as its own piece of state —
  // it's just a comma-separated escape hatch for whatever isn't in the
  // chip list, same parsing rule as the free-text field on /profile.
  const extraAllergies = otherAllergy
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allAllergies = [...allergies, ...extraAllergies.filter((item) => !allergies.includes(item))];

  return (
    <div className="wobble-a hand-shadow border-2 border-ink bg-cream-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <Mascot className="h-12 w-11" />
        <form>
          <button
            formAction={skipOnboarding}
            className="border-b-2 border-dashed border-ink-soft text-sm font-bold text-ink-soft transition hover:text-ink"
          >
            Skip for now
          </button>
        </form>
      </div>

      {/* Progress dots — one per step, filled up through the current one,
          and clickable so you can jump straight to any step. */}
      <div className="mb-6 flex gap-1.5">
        {STEPS.map((s, index) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStepIndex(index)}
            aria-label={`Go to step ${index + 1}: ${s.title}`}
            className={`h-2 flex-1 rounded-full transition hover:brightness-90 ${
              index <= stepIndex ? "bg-tomato-400" : "bg-cream-deep"
            }`}
          />
        ))}
      </div>

      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-tomato-400">
        {step.eyebrow}
      </p>
      <h1 className="mb-6 font-display text-2xl font-bold text-ink sm:text-3xl">{step.title}</h1>

      <form
        className="flex flex-col gap-6"
        onKeyDown={(event) => {
          // Steps only ever advance via the Back/Continue/Finish buttons —
          // nothing else in here should submit anything. Without this,
          // pressing Enter after typing a household size (very natural)
          // triggers the browser's *implicit* form submission, which fires
          // the first submit-type control in the DOM. On this last step
          // that's the Finish button, so it silently ran completeOnboarding
          // before the user ever clicked it. Only suppressing this for
          // non-button targets keeps Enter/Space still working to activate
          // a focused button via the keyboard.
          if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
            event.preventDefault();
          }
        }}
      >
        {/* All four steps' state lives in this one form the whole time —
            only the CURRENT step's controls are visible, but every
            step's hidden inputs stay mounted so nothing is lost moving
            back and forth, and the final submit carries everything at
            once. */}
        {step.key === "cuisine" && (
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={cuisinePreferences.includes(option)}
                onClick={() => setCuisinePreferences((prev) => toggle(prev, option))}
              />
            ))}
          </div>
        )}

        {step.key === "dietary" && (
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={dietaryPreferences.includes(option)}
                onClick={() => setDietaryPreferences((prev) => toggle(prev, option))}
              />
            ))}
          </div>
        )}

        {step.key === "allergies" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {ALLERGY_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={allergies.includes(option)}
                  onClick={() => setAllergies((prev) => toggle(prev, option))}
                />
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Anything else?
              <input
                type="text"
                value={otherAllergy}
                onChange={(event) => setOtherAllergy(event.target.value)}
                placeholder="comma-separated, e.g. avocado, mustard"
                className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
              />
            </label>
          </div>
        )}

        {step.key === "household" && (
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Household size
              <input
                type="number"
                min={1}
                max={20}
                step={1}
                value={householdSize}
                onChange={(event) => setHouseholdSize(Number(event.target.value))}
                className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold text-ink-soft">
              Units
              <select
                value={unitSystem}
                onChange={(event) => setUnitSystem(event.target.value as "metric" | "imperial")}
                className="rounded-xl border-2 border-ink-faint bg-cream-deep px-4 py-2.5 text-base text-ink outline-none focus:border-ink"
              >
                <option value="imperial">Imperial (cups, oz, lb)</option>
                <option value="metric">Metric (ml, g, kg)</option>
              </select>
            </label>
          </div>
        )}

        <HiddenList name="cuisinePreferences" values={cuisinePreferences} />
        <HiddenList name="dietaryPreferences" values={dietaryPreferences} />
        <HiddenList name="allergies" values={allAllergies} />
        <input type="hidden" name="householdSize" value={householdSize} />
        <input type="hidden" name="unitSystem" value={unitSystem} />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className={`font-display text-sm font-semibold text-ink-soft transition hover:text-ink ${
              stepIndex === 0 ? "invisible" : ""
            }`}
          >
            Back
          </button>

          {isLastStep ? (
            // key="finish" (vs. key="continue" below) forces React to treat
            // these as two distinct buttons instead of reusing the same DOM
            // node when isLastStep flips. Without that, React can leave the
            // reused node still wired to submit the form (formAction) for a
            // render or two after it's visually showing "Continue" — which
            // is exactly what was firing completeOnboarding the moment you
            // clicked Continue on step 3, before step 4 ever appeared.
            <button
              key="finish"
              type="submit"
              formAction={completeOnboarding}
              className="wobble-btn hand-shadow bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
            >
              Finish
            </button>
          ) : (
            <button
              key="continue"
              type="button"
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
              className="wobble-btn hand-shadow bg-tomato-400 px-5 py-2.5 font-display text-sm font-semibold text-cream transition hover:brightness-105"
            >
              Continue
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

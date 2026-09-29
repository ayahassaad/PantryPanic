"use client";

import { useEffect, useRef, useState } from "react";

// Same cursor-tracking behavior as the tomato Mascot (components/mascot.tsx),
// duplicated in miniature here rather than shared — this file is meant to be
// a self-contained drop-in for the one place that needed it (the recipe card
// placeholder), without touching mascot.tsx, which a bunch of other pages
// already render as-is.
const LEFT_EYE_CENTER = { x: 52, y: 76 };
const RIGHT_EYE_CENTER = { x: 88, y: 74 };
const EYE_SOCKET_RADIUS = 13;
const PUPIL_RADIUS = 5.5;
const MAX_PUPIL_TRAVEL = EYE_SOCKET_RADIUS - PUPIL_RADIUS - 2;
const REST_OFFSET = { x: 2, y: 3 };

const STROKE = "oklch(24% 0.03 150)";
const CREAM = "oklch(99% 0.006 85)";

export type FoodKind =
  | "tomato"
  | "carrot"
  | "egg"
  | "pepper"
  | "citrus"
  | "grape"
  | "cheese"
  | "mug"
  | "broccoli"
  | "fish"
  | "chicken"
  | "beef"
  | "shrimp"
  | "onion"
  | "garlic"
  | "mushroom"
  | "potato"
  | "rice"
  | "pasta"
  | "bread"
  | "corn"
  | "avocado"
  | "spinach"
  | "banana"
  | "apple"
  | "chocolate";

// Keyword match, checked first against the recipe's actual ingredient
// names (the real "what's this dish made of" signal) and only falling
// back to its title + description if nothing in the ingredient list
// matches — see inferFoodKind below.
//
// Order matters within each pass — first match wins — and it's grouped
// into rough tiers, most-defining first, rather than alphabetical or
// however these happened to get added:
//   1. proteins (egg, shrimp, fish, chicken, beef)
//   2. carbs/mains (rice, pasta, bread, potato, corn)
//   3. produce that usually IS the dish (avocado, banana, apple,
//      mushroom, broccoli, spinach, carrot, citrus, grape)
//   4. flavor/dairy components (cheese, chocolate, mug)
//   5. aromatics that show up in almost everything but rarely define a
//      dish on their own (pepper, onion, garlic)
// That ordering is what keeps "garlic butter shrimp" landing on shrimp
// instead of garlic, and "chicken and rice" landing on chicken instead
// of rice — without it, the near-universal aromatics at the bottom
// would win almost every match just by being common, not by being what
// the dish is actually about.
const KIND_PATTERNS: Array<[FoodKind, RegExp]> = [
  ["egg", /\begg(s)?\b/i],
  ["shrimp", /\b(shrimp|prawns?|scallops?|crab)\b/i],
  ["fish", /\b(fish|salmon|tuna|cod|tilapia|trout|halibut|anchov(y|ies))\b/i],
  ["chicken", /\b(chicken|turkey|poultry)\b/i],
  ["beef", /\b(beef|steak|pork|bacon|ham|sausage|lamb|meatballs?|ground meat)\b/i],
  ["rice", /\brice\b/i],
  ["pasta", /\b(pasta|spaghetti|noodles?|penne|fettuccine|macaroni|linguine|lasagn(a|e))\b/i],
  ["bread", /\b(bread|baguette|toast|bun|rolls?)\b/i],
  ["potato", /\bpotato(es)?\b/i],
  ["corn", /\bcorn\b/i],
  ["avocado", /\bavocados?\b/i],
  ["banana", /\bbananas?\b/i],
  ["apple", /\bapples?\b/i],
  ["mushroom", /\bmushrooms?\b/i],
  ["broccoli", /\bbroccoli\b/i],
  ["spinach", /\b(spinach|kale|arugula|lettuce|leafy greens?)\b/i],
  ["carrot", /\bcarrots?\b/i],
  ["citrus", /\b(lemons?|limes?|oranges?|citrus|grapefruit)\b/i],
  ["grape", /\b(grapes?|wine)\b/i],
  ["cheese", /\b(cheese|parmesan|mozzarella|cheddar|feta|ricotta)\b/i],
  ["chocolate", /\b(chocolate|cocoa|cacao)\b/i],
  ["mug", /\b(coffee|espresso|latte|tea|mug)\b/i],
  ["pepper", /\b(peppers?|chil(i|e|li)(es)?|jalape[nñ]os?|capsicum)\b/i],
  ["onion", /\bonions?\b/i],
  ["garlic", /\bgarlic\b/i],
];

// ingredientNames (when there are any) is checked first and entirely
// before titleAndDescription is looked at at all — a recipe's actual
// ingredient list is a much more reliable "main ingredient" signal than
// whatever words happen to be in its title, so a real ingredient match
// always wins over a title-only guess rather than the two being merged
// and left to pattern order to referee. Only when nothing in the
// ingredient list matches anything does this fall back to reading the
// title/description the way this used to work for every recipe (still
// needed for the handful of places — the planner's own "type a new
// recipe in" flow, mainly — that don't have a structured ingredient list
// to draw on at all).
export function inferFoodKind(titleAndDescription: string, ingredientNames: string[] = []): FoodKind {
  if (ingredientNames.length > 0) {
    const ingredientText = ingredientNames.join(" ");
    for (const [kind, pattern] of KIND_PATTERNS) {
      if (pattern.test(ingredientText)) return kind;
    }
  }
  for (const [kind, pattern] of KIND_PATTERNS) {
    if (pattern.test(titleAndDescription)) return kind;
  }
  return "tomato";
}

// Nine-grape cluster, typed as fixed tuples for the same reason
// food-doodles.tsx's GRAPE_POSITIONS is — noUncheckedIndexedAccess turns a
// destructured plain number[][] entry into `number | undefined`.
const GRAPE_CLUSTER: Array<[number, number]> = [
  [70, 44],
  [48, 64],
  [92, 64],
  [36, 92],
  [70, 96],
  [104, 92],
  [52, 120],
  [88, 120],
  [70, 142],
];

export function FoodMascot({ kind, className }: { kind: FoodKind; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pupilOffset, setPupilOffset] = useState(REST_OFFSET);

  useEffect(() => {
    // Touch devices have no real cursor to follow — leave the eyes at
    // their resting pose instead of doing needless work.
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    let frame = 0;

    function handleMouseMove(event: MouseEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const faceX = rect.left + (rect.width * 70) / 140;
        const faceY = rect.top + (rect.height * 75) / 160;

        const dx = event.clientX - faceX;
        const dy = event.clientY - faceY;
        const distance = Math.hypot(dx, dy) || 1;
        const travel = Math.min(distance / 12, MAX_PUPIL_TRAVEL);

        setPupilOffset({
          x: (dx / distance) * travel,
          y: (dy / distance) * travel,
        });
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const pupilStyle = {
    transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
    transition: "transform 80ms ease-out",
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 140 160"
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {/* legs + arms: identical silhouette on every food, so the whole set
          reads as one goofy character family rather than unrelated icons */}
      <path d="M55,118 C50,132 44,140 34,146" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="30" cy="149" rx="10" ry="5" fill={STROKE} transform="rotate(-18 30 149)" />
      <path d="M82,120 C90,133 98,140 108,145" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="112" cy="148" rx="10" ry="5" fill={STROKE} transform="rotate(18 112 148)" />
      <path d="M92,72 C112,64 122,46 118,28" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      <circle cx="119" cy="24" r="7" fill={CREAM} stroke={STROKE} strokeWidth="3.5" />
      <path d="M46,80 C30,90 20,92 10,88" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      <circle cx="8" cy="86" r="7" fill={CREAM} stroke={STROKE} strokeWidth="3.5" />

      <FoodBody kind={kind} />

      {/* eyes: same sockets + tracking for every kind */}
      <circle cx={LEFT_EYE_CENTER.x} cy={LEFT_EYE_CENTER.y} r={EYE_SOCKET_RADIUS} fill={CREAM} stroke={STROKE} strokeWidth="3" />
      <g style={pupilStyle}>
        <circle cx={LEFT_EYE_CENTER.x} cy={LEFT_EYE_CENTER.y} r={PUPIL_RADIUS} fill={STROKE} />
        <circle cx={LEFT_EYE_CENTER.x + 2} cy={LEFT_EYE_CENTER.y - 3} r="1.8" fill={CREAM} />
      </g>
      <circle cx={RIGHT_EYE_CENTER.x} cy={RIGHT_EYE_CENTER.y} r={EYE_SOCKET_RADIUS} fill={CREAM} stroke={STROKE} strokeWidth="3" />
      <g style={pupilStyle}>
        <circle cx={RIGHT_EYE_CENTER.x} cy={RIGHT_EYE_CENTER.y} r={PUPIL_RADIUS} fill={STROKE} />
        <circle cx={RIGHT_EYE_CENTER.x + 2} cy={RIGHT_EYE_CENTER.y - 3} r="1.8" fill={CREAM} />
      </g>
      <path d="M56,102 C64,112 76,112 86,101" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// The one part that actually varies by ingredient: body silhouette,
// color, and whatever garnish (leafy top, stem, steam, holes...) sells it.
function FoodBody({ kind }: { kind: FoodKind }) {
  switch (kind) {
    case "carrot":
      return (
        <>
          <path
            d="M60,32 C56,20 46,16 38,19 C46,24 50,28 52,33 Z M80,32 C84,20 94,16 102,19 C94,24 90,28 88,33 Z"
            fill="oklch(62% 0.13 145)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M70,40 C95,42 110,70 104,100 C98,130 84,150 70,152 C56,150 42,130 36,100 C30,70 45,42 70,40 Z"
            fill="oklch(68% 0.17 55)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M55,58 L58,48 M70,54 L70,42 M85,58 L82,48" stroke="oklch(48% 0.12 145)" strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case "egg":
      return (
        <>
          <path
            d="M70,26 C40,30 26,66 30,100 C34,132 50,150 70,150 C90,150 106,132 110,100 C114,66 100,30 70,26 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <ellipse cx="58" cy="72" rx="15" ry="11" fill="oklch(80% 0.15 95)" stroke={STROKE} strokeWidth="1.8" opacity="0.9" />
        </>
      );
    case "pepper":
      return (
        <>
          <path
            d="M70,36 C40,38 30,60 34,86 C38,116 52,144 70,146 C88,144 102,116 106,86 C110,60 100,38 70,36 Z"
            fill="oklch(62% 0.13 145)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M70,36 C68,24 60,18 50,17" fill="none" stroke="oklch(48% 0.12 145)" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "citrus":
      return (
        <>
          <circle cx="70" cy="92" r="56" fill="oklch(80% 0.15 95)" stroke={STROKE} strokeWidth="4.5" />
          <circle cx="70" cy="92" r="40" fill="none" stroke={CREAM} strokeWidth="3" />
          <path
            d="M70,92 L102,92 M70,92 L86,120 M70,92 L54,120 M70,92 L38,92 M70,92 L54,64 M70,92 L86,64"
            stroke={CREAM}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "grape":
      return (
        <>
          <path d="M70,38 C70,28 66,20 58,14" fill="none" stroke="oklch(48% 0.12 145)" strokeWidth="3" strokeLinecap="round" />
          {GRAPE_CLUSTER.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="19" fill="oklch(52% 0.13 290)" stroke={STROKE} strokeWidth="3" />
          ))}
        </>
      );
    case "cheese":
      return (
        <>
          <path
            d="M70,14 C90,40 108,90 118,138 C118,146 112,150 104,150 L36,150 C28,150 22,146 22,138 C32,90 50,40 70,14 Z"
            fill="oklch(78% 0.13 75)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <circle cx="53" cy="98" r="8" fill={CREAM} stroke={STROKE} strokeWidth="2" />
          <circle cx="82" cy="118" r="7" fill={CREAM} stroke={STROKE} strokeWidth="2" />
          <circle cx="64" cy="132" r="6" fill={CREAM} stroke={STROKE} strokeWidth="2" />
          <circle cx="92" cy="88" r="5" fill={CREAM} stroke={STROKE} strokeWidth="1.8" />
        </>
      );
    case "mug":
      return (
        <>
          {/* Trapezoid body (wider rim, narrower base) reads as an
              actual cup silhouette instead of the plain rounded
              rectangle this used to be, which looked more like a
              book/tablet than a mug. */}
          <path d="M108,72 C130,72 130,104 108,104" fill="none" stroke={STROKE} strokeWidth="5" />
          <path
            d="M30,46 L110,46 C114,46 116,49 116,54 L108,138 C107,144 102,148 96,148 L44,148 C38,148 33,144 32,138 L24,54 C24,49 26,46 30,46 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M28,64 L112,64" stroke="oklch(45% 0.08 50)" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
          <path
            d="M50,40 C46,32 54,28 50,20 M69,40 C65,32 73,28 69,20 M88,40 C84,32 92,28 88,20"
            fill="none"
            stroke="oklch(70% 0.02 150)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "broccoli":
      return (
        <>
          <rect x="58" y="108" width="24" height="42" rx="7" fill="oklch(93% 0.03 85)" stroke={STROKE} strokeWidth="3.5" />
          <circle cx="42" cy="88" r="30" fill="oklch(58% 0.14 148)" stroke={STROKE} strokeWidth="4" />
          <circle cx="98" cy="88" r="30" fill="oklch(58% 0.14 148)" stroke={STROKE} strokeWidth="4" />
          <circle cx="70" cy="58" r="34" fill="oklch(58% 0.14 148)" stroke={STROKE} strokeWidth="4" />
        </>
      );
    case "fish":
      return (
        <>
          <ellipse cx="62" cy="88" rx="52" ry="46" fill="oklch(72% 0.1 220)" stroke={STROKE} strokeWidth="4.5" />
          {/* Bowtie-shaped tail fin, unmistakably a fish tail rather
              than the barely-there nub the first version had. */}
          <path
            d="M104,68 L134,44 L128,88 L134,132 L104,108 Z"
            fill="oklch(72% 0.1 220)"
            stroke={STROKE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M62,42 L74,24 L84,44 Z"
            fill="oklch(72% 0.1 220)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M40,66 C48,62 58,62 64,66 M36,108 C48,116 64,116 76,108 M96,80 C100,86 100,94 96,100"
            fill="none"
            stroke="oklch(56% 0.09 220)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "chicken":
      return (
        <>
          {/* A proper drumstick shape (meat lobe + angled bone with a
              knuckle) rather than the earlier version, whose "bone"
              was too thin and short to read as anything at all. */}
          <path
            d="M68,34 C94,34 112,54 108,80 C104,106 82,124 56,118 C34,112 20,92 24,68 C28,46 46,34 68,34 Z"
            fill="oklch(72% 0.12 55)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M78,104 C90,114 100,126 102,142"
            fill="none"
            stroke="oklch(90% 0.02 85)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <circle cx="104" cy="146" r="11" fill="oklch(90% 0.02 85)" stroke={STROKE} strokeWidth="3" />
          <path
            d="M46,58 L54,50 M70,52 L74,42 M92,64 L100,56"
            stroke="oklch(56% 0.1 55)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "beef":
      return (
        <>
          <path
            d="M30,52 C26,40 38,32 50,36 C66,26 96,30 108,48 C120,64 118,88 108,104 C114,118 106,132 90,136 C76,148 54,148 40,134 C24,128 20,108 28,92 C18,78 20,62 30,52 Z"
            fill="oklch(50% 0.13 25)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          {/* Fat-cap highlight along one edge plus thick, high-contrast
              grill marks — the first pass's thin lines barely showed up
              against the dark meat and this just read as a maroon blob. */}
          <path
            d="M30,52 C40,46 60,44 76,50"
            fill="none"
            stroke="oklch(78% 0.06 70)"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M40,60 L96,108 M50,100 L100,56 M34,84 L84,124"
            stroke="oklch(30% 0.09 30)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      );
    case "shrimp":
      return (
        <>
          {/* One thick curled "C" stroke (outlined by drawing it twice,
              black then the shrimp color, same path) instead of the
              first version's jagged overlapping blobs, which read as a
              fried egg with red squiggles rather than a curled shrimp. */}
          <path
            d="M40,130 C20,116 16,90 32,68 C46,48 76,38 98,50 C106,55 110,63 108,72"
            fill="none"
            stroke={STROKE}
            strokeWidth="38"
            strokeLinecap="round"
          />
          <path
            d="M40,130 C20,116 16,90 32,68 C46,48 76,38 98,50 C106,55 110,63 108,72"
            fill="none"
            stroke="oklch(70% 0.16 40)"
            strokeWidth="30"
            strokeLinecap="round"
          />
          <path
            d="M100,56 L124,40 L132,62 L118,80 L100,66 Z"
            fill="oklch(70% 0.16 40)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M36,100 L50,92 M46,80 L60,74 M62,60 L74,56 M82,50 L94,50"
            stroke="oklch(56% 0.13 40)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M44,124 C36,128 26,128 18,122 M50,112 C42,118 32,120 24,116 M34,132 C26,140 16,142 8,138"
            fill="none"
            stroke="oklch(56% 0.13 40)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "onion":
      return (
        <>
          <path
            d="M70,40 C94,44 108,68 106,96 C104,124 88,146 70,148 C52,146 36,124 34,96 C32,68 46,44 70,40 Z"
            fill="oklch(88% 0.04 85)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,148 C58,148 50,132 54,110 M70,148 C82,148 90,132 86,110"
            fill="none"
            stroke="oklch(70% 0.05 70)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M62,40 C58,26 62,14 70,8 M78,40 C82,26 78,14 70,8"
            fill="none"
            stroke="oklch(58% 0.12 145)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </>
      );
    case "garlic":
      return (
        <>
          {/* Lumpy/bulbous outline (individual clove bumps) instead of
              a smooth oval — the first pass was nearly indistinguishable
              from onion right next to it. */}
          <path
            d="M70,44 C90,42 100,60 96,80 C110,84 112,102 100,112 C104,126 92,138 78,134 C74,142 62,142 58,134 C44,138 32,126 36,112 C24,102 26,84 40,80 C36,60 50,42 70,44 Z"
            fill="oklch(96% 0.01 85)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,44 L70,134 M50,52 C44,78 44,108 54,132 M90,52 C96,78 96,108 86,132"
            fill="none"
            stroke="oklch(85% 0.02 85)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M63,44 C59,30 63,18 70,12 M77,44 C81,30 77,18 70,12"
            fill="none"
            stroke="oklch(60% 0.1 90)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "mushroom":
      return (
        <>
          {/* Pale tan cap (a button mushroom) instead of the first
              pass's pinkish-salmon color, which read more like ham than
              a mushroom. */}
          <path
            d="M24,80 C24,50 44,30 70,30 C96,30 116,50 116,80 C116,87 111,92 102,92 L38,92 C29,92 24,87 24,80 Z"
            fill="oklch(85% 0.03 70)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M32,84 C40,90 100,90 108,84" fill="none" stroke="oklch(66% 0.05 60)" strokeWidth="3" opacity="0.6" />
          <rect x="56" y="92" width="28" height="52" rx="12" fill="oklch(94% 0.015 85)" stroke={STROKE} strokeWidth="4" />
          <circle cx="44" cy="58" r="5" fill={CREAM} opacity="0.7" />
          <circle cx="66" cy="46" r="4" fill={CREAM} opacity="0.7" />
          <circle cx="92" cy="60" r="5" fill={CREAM} opacity="0.7" />
        </>
      );
    case "potato":
      return (
        <>
          <path
            d="M70,38 C96,34 116,54 116,82 C116,112 100,142 70,146 C42,142 26,114 28,84 C30,54 48,42 70,38 Z"
            fill="oklch(66% 0.06 70)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <circle cx="52" cy="70" r="3" fill="oklch(50% 0.05 70)" opacity="0.6" />
          <circle cx="86" cy="60" r="3" fill="oklch(50% 0.05 70)" opacity="0.6" />
          <circle cx="90" cy="100" r="3" fill="oklch(50% 0.05 70)" opacity="0.6" />
          <circle cx="56" cy="112" r="3" fill="oklch(50% 0.05 70)" opacity="0.6" />
        </>
      );
    case "rice":
      return (
        <>
          {/* Bowl now a distinct blue-gray (not the same near-white as
              the rice mound sitting on it) with a rim-shadow line for
              depth, plus more individual grain marks — the first pass's
              two colors were close enough to blend into one pale blob
              with a couple of stray cracks. */}
          <path
            d="M20,88 C20,82 26,80 70,80 C114,80 120,82 120,88 C120,116 98,142 70,142 C42,142 20,116 20,88 Z"
            fill="oklch(90% 0.02 220)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M20,88 C20,94 26,98 70,98 C114,98 120,94 120,88" fill="none" stroke={STROKE} strokeWidth="3" opacity="0.4" />
          <path
            d="M40,80 C42,58 54,44 70,44 C86,44 98,58 100,80 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M50,64 L52,56 M60,58 L60,48 M70,56 L70,46 M80,58 L80,48 M90,64 L88,56"
            stroke="oklch(85% 0.02 85)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "pasta":
      return (
        <>
          <circle cx="70" cy="94" r="52" fill="oklch(88% 0.08 85)" stroke={STROKE} strokeWidth="4.5" />
          <path
            d="M30,80 C50,70 46,100 66,92 C86,84 82,112 104,100 M34,104 C54,96 50,124 72,116 C90,110 88,130 102,124"
            fill="none"
            stroke="oklch(75% 0.1 70)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="88" cy="70" r="8" fill="oklch(48% 0.13 30)" stroke={STROKE} strokeWidth="2.5" />
        </>
      );
    case "bread":
      return (
        <>
          <path
            d="M24,100 C24,64 44,36 70,36 C96,36 116,64 116,100 C116,124 96,142 70,142 C44,142 24,124 24,100 Z"
            fill="oklch(78% 0.1 70)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M48,56 C52,44 60,38 70,38 C80,38 88,44 92,56"
            fill="oklch(88% 0.08 75)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M54,64 L60,86 M70,58 L70,88 M86,64 L80,86" stroke="oklch(58% 0.09 60)" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "corn":
      return (
        <>
          <path
            d="M70,26 C90,26 100,44 98,72 C96,102 88,138 70,148 C52,138 44,102 42,72 C40,44 50,26 70,26 Z"
            fill="oklch(84% 0.13 95)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M52,50 L88,50 M50,66 L90,66 M50,82 L90,82 M52,98 L88,98 M56,114 L84,114"
            stroke="oklch(70% 0.1 85)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M58,26 C50,14 36,10 24,14 M82,26 C90,14 104,10 116,14"
            fill="none"
            stroke="oklch(58% 0.12 145)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </>
      );
    case "avocado":
      return (
        <>
          <path
            d="M70,30 C96,34 112,60 110,92 C108,124 90,148 70,148 C50,148 32,124 30,92 C28,60 44,34 70,30 Z"
            fill="oklch(58% 0.12 140)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,44 C88,48 100,68 98,92 C96,116 82,134 70,134 C58,134 44,116 42,92 C40,68 52,48 70,44 Z"
            fill="oklch(88% 0.13 120)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="70" cy="92" r="20" fill="oklch(55% 0.14 50)" stroke={STROKE} strokeWidth="3" />
        </>
      );
    case "spinach":
      return (
        <>
          <path
            d="M70,40 C48,36 30,52 30,78 C30,100 46,116 70,116 C94,116 110,100 110,78 C110,52 92,36 70,40 Z"
            fill="oklch(60% 0.13 142)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,40 L70,116 M46,58 C54,70 58,92 54,108 M94,58 C86,70 82,92 86,108"
            fill="none"
            stroke="oklch(46% 0.11 140)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M70,116 C66,128 66,140 70,150" stroke="oklch(46% 0.11 140)" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      );
    case "banana":
      return (
        <>
          <path
            d="M40,132 C30,110 32,80 50,54 C64,34 88,24 108,28 C112,36 110,46 100,50 C82,58 66,72 56,94 C50,108 52,120 60,130 C52,138 44,138 40,132 Z"
            fill="oklch(86% 0.14 100)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M100,26 C104,20 112,18 118,22" stroke="oklch(58% 0.1 90)" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path
            d="M50,60 C64,48 82,40 98,38"
            stroke="oklch(72% 0.1 90)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
        </>
      );
    case "apple":
      return (
        <>
          <path
            d="M70,50 C96,46 114,66 112,94 C110,122 92,146 70,146 C48,146 30,122 28,94 C26,66 44,46 70,50 Z"
            fill="oklch(58% 0.19 25)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M70,50 C68,38 70,28 76,20" stroke="oklch(48% 0.1 70)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path
            d="M76,24 C84,16 94,16 100,24 C92,28 84,30 76,24 Z"
            fill="oklch(62% 0.14 145)"
            stroke={STROKE}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse cx="52" cy="76" rx="9" ry="6" fill="oklch(70% 0.15 45)" opacity="0.6" />
        </>
      );
    case "chocolate":
      return (
        <>
          <rect x="26" y="40" width="88" height="100" rx="10" fill="oklch(38% 0.08 40)" stroke={STROKE} strokeWidth="4.5" />
          <path
            d="M26,73 L114,73 M26,107 L114,107 M59,40 L59,140 M92,40 L92,140"
            stroke="oklch(30% 0.06 40)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "tomato":
    default:
      return (
        <>
          <path d="M70,26 C64,10 54,4 44,8 C52,14 55,20 55,26 Z" fill="oklch(62% 0.13 145)" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
          <path d="M70,24 C70,6 78,-2 90,0 C82,8 78,15 76,24 Z" fill="oklch(62% 0.13 145)" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
          <path d="M74,26 C82,12 94,8 102,14 C92,18 87,23 82,29 Z" fill="oklch(62% 0.13 145)" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
          <path
            d="M70,30 C98,28 120,52 118,80 C116,110 96,132 68,130 C38,128 16,106 18,78 C20,50 42,32 70,30 Z"
            fill="oklch(62% 0.19 25)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <ellipse cx="38" cy="90" rx="9" ry="6" fill="oklch(68% 0.17 55)" opacity="0.75" />
          <ellipse cx="100" cy="88" rx="9" ry="6" fill="oklch(68% 0.17 55)" opacity="0.75" />
        </>
      );
  }
}

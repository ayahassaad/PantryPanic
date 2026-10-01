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
          {/* A fried egg, face on the yolk — the old plain white oval
              with a yolk patch beside one eye read as a blank blob. */}
          <path
            d="M70,24 C92,18 112,34 116,56 C128,70 128,98 114,114 C110,136 88,150 68,146 C46,152 24,138 22,114 C8,98 12,68 26,56 C28,34 48,22 70,24 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <circle cx="70" cy="86" r="38" fill="oklch(82% 0.16 90)" stroke={STROKE} strokeWidth="3" />
          <path d="M78,53 C86,53 94,57 99,63" fill="none" stroke={CREAM} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        </>
      );
    case "pepper":
      return (
        <>
          {/* A bell pepper: square shoulders, a dip at the stem and three
              lobes along the bottom, instead of the smooth green egg
              shape this used to be. */}
          <path d="M70,42 C70,28 66,20 56,15" fill="none" stroke={STROKE} strokeWidth="10" strokeLinecap="round" />
          <path d="M70,42 C70,28 66,20 56,15" fill="none" stroke="oklch(48% 0.12 145)" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M70,40 C60,32 40,34 32,50 C24,66 28,100 36,122 C42,140 56,148 62,138 C66,150 76,150 80,138 C86,148 100,140 106,122 C114,100 118,66 108,50 C100,34 80,32 70,40 Z"
            fill="oklch(62% 0.15 145)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M57,44 C50,70 52,110 62,136 M83,44 C90,70 88,110 80,136"
            fill="none"
            stroke="oklch(48% 0.12 145)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.6"
          />
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
          {/* A drumstick held bone-up: one plump teardrop of meat (wide
              enough to carry the whole face) narrowing into a bone with
              the classic two-knuckle end. Replaces the round blob with a
              bone for a leg, which didn't read as chicken at all. */}
          <rect x="62" y="16" width="16" height="34" rx="6" fill="oklch(94% 0.02 85)" stroke={STROKE} strokeWidth="3.5" />
          <circle cx="61" cy="14" r="9" fill="oklch(94% 0.02 85)" stroke={STROKE} strokeWidth="3.5" />
          <circle cx="79" cy="14" r="9" fill="oklch(94% 0.02 85)" stroke={STROKE} strokeWidth="3.5" />
          <rect x="64.5" y="12" width="11" height="20" fill="oklch(94% 0.02 85)" />
          <path
            d="M70,40 C58,44 28,62 28,98 C28,128 48,148 70,148 C92,148 112,128 112,98 C112,62 82,44 70,40 Z"
            fill="oklch(70% 0.13 60)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M38,112 C40,124 48,134 58,138 M98,104 C100,112 98,120 94,126"
            fill="none"
            stroke="oklch(56% 0.11 55)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M60,50 C52,54 46,60 42,66" fill="none" stroke="oklch(84% 0.09 75)" strokeWidth="3.5" strokeLinecap="round" />
        </>
      );
    case "beef":
      return (
        <>
          {/* A steak: a pale rim of fat all the way round, red meat
              inside it, a little round bone and a few flecks of marbling
              — nothing drawn across the face any more (the old grill
              marks ran straight through the eyes and mouth). */}
          <path
            d="M30,52 C26,40 38,32 50,36 C66,26 96,30 108,48 C120,64 118,88 108,104 C114,118 106,132 90,136 C76,148 54,148 40,134 C24,128 20,108 28,92 C18,78 20,62 30,52 Z"
            fill="oklch(90% 0.04 80)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M30,52 C26,40 38,32 50,36 C66,26 96,30 108,48 C120,64 118,88 108,104 C114,118 106,132 90,136 C76,148 54,148 40,134 C24,128 20,108 28,92 C18,78 20,62 30,52 Z"
            fill="oklch(58% 0.17 25)"
            stroke="oklch(46% 0.15 25)"
            strokeWidth="2"
            transform="translate(69 88) scale(0.82) translate(-69 -88)"
          />
          <circle cx="45" cy="52" r="8" fill="oklch(95% 0.02 85)" stroke={STROKE} strokeWidth="2.5" />
          <path
            d="M84,48 C90,48 95,51 98,56 M44,118 C48,124 54,127 60,127 M88,116 C92,113 94,109 95,105"
            fill="none"
            stroke="oklch(86% 0.05 70)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "shrimp":
      return (
        <>
          {/* A plump prawn seen side-on: tail fan, two long feelers, a
              pointed beak and banded segments down the belly. The face
              sits on the body now — the old thick "C" stroke left the
              eyes floating in the hole in the middle of it. */}
          <path
            d="M60,38 C54,22 40,12 24,12 M72,36 C70,20 60,8 46,3"
            fill="none"
            stroke="oklch(56% 0.14 35)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M40,122 L10,116 L18,132 L8,146 L34,142 Z"
            fill="oklch(62% 0.16 30)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M82,38 L96,16 L100,44 Z"
            fill="oklch(62% 0.16 30)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,34 C100,34 116,58 114,90 C112,122 94,144 66,144 C42,144 26,128 24,104 C22,70 40,34 70,34 Z"
            fill="oklch(74% 0.14 35)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M32,116 C50,128 90,128 108,114 M44,132 C56,140 82,140 96,130 M34,58 C46,50 58,46 70,46"
            fill="none"
            stroke="oklch(58% 0.15 32)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case "onion":
      return (
        <>
          {/* A golden onion with a pointed neck, layer lines, a green
              sprout and root hairs — the old pale oval was nearly
              indistinguishable from the garlic next to it. */}
          <path
            d="M70,34 C66,22 58,14 48,11 M70,34 C72,20 80,12 90,9"
            fill="none"
            stroke="oklch(58% 0.13 145)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M61,146 L58,154 M70,148 L70,156 M79,146 L82,154" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M70,30 C74,40 84,46 94,54 C110,66 114,92 104,118 C96,138 84,148 70,148 C56,148 44,138 36,118 C26,92 30,66 46,54 C56,46 66,40 70,30 Z"
            fill="oklch(76% 0.12 75)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,36 C60,62 56,110 64,144 M70,36 C80,62 84,110 76,144 M50,56 C38,82 38,116 50,136 M90,56 C102,82 102,116 90,136"
            fill="none"
            stroke="oklch(60% 0.1 65)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.6"
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
          {/* Lumpier outline and a few crescent "eyes" — the smooth
              brown oval could be mistaken for an egg or a loaf. */}
          <path
            d="M60,36 C84,28 108,40 114,66 C120,90 116,122 98,138 C82,152 54,150 40,136 C24,120 22,94 28,72 C32,52 44,40 60,36 Z"
            fill="oklch(70% 0.08 75)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,46 c3,-3 7,-3 10,0 M100,96 c3,-3 6,-3 9,0 M36,104 c3,-3 6,-3 9,0 M56,128 c3,-3 7,-3 10,0 M88,124 c2,-3 6,-3 8,0"
            fill="none"
            stroke="oklch(48% 0.06 65)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "rice":
      return (
        <>
          {/* A proper rice bowl: the rim sits above the eyes so the whole
              face is on the bowl (it used to straddle the rim), the bowl
              is a clear blue rather than a near-white that blended into
              the rice, and a pair of chopsticks says "rice" from a
              distance. */}
          <path d="M34,8 L62,52 M46,4 L70,50" stroke={STROKE} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M34,8 L62,52 M46,4 L70,50" stroke="oklch(66% 0.1 60)" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M30,58 C30,36 48,24 70,24 C92,24 110,36 110,58 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M48,44 l6,-3 M64,36 l6,-2 M80,40 l6,2 M92,50 l5,3 M60,50 l6,-2 M78,52 l6,1 M42,54 l5,-2"
            stroke="oklch(80% 0.03 85)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M16,58 L124,58 C124,100 102,146 70,146 C38,146 16,100 16,58 Z"
            fill="oklch(72% 0.09 235)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M36,128 C52,138 88,138 104,128" fill="none" stroke="oklch(88% 0.04 235)" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "pasta":
      return (
        <>
          {/* A bowl of spaghetti with a meatball on top — a heap of
              noodle swirls above a white bowl with a red stripe. The
              old plain yellow disc with two squiggles read as nothing
              in particular. */}
          <path
            d="M26,58 C26,36 46,26 70,26 C94,26 114,36 114,58 Z"
            fill="oklch(88% 0.1 90)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M36,54 C38,40 52,34 60,40 C68,46 58,54 50,50 M66,34 C80,30 94,36 100,48 M78,54 C76,46 86,42 92,48 M44,36 C52,30 60,30 66,32"
            fill="none"
            stroke="oklch(70% 0.12 80)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M70,30 C74,22 96,18 104,26 C110,32 104,40 96,40 C86,42 74,38 70,30 Z"
            fill="oklch(58% 0.19 28)"
            stroke={STROKE}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="88" cy="22" r="11" fill="oklch(46% 0.09 45)" stroke={STROKE} strokeWidth="3" />
          <path
            d="M16,58 L124,58 C124,100 102,146 70,146 C38,146 16,100 16,58 Z"
            fill={CREAM}
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M34,126 C50,138 90,138 106,126" fill="none" stroke="oklch(62% 0.19 25)" strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "bread":
      return (
        <>
          {/* A slice of toast: the two-bump top and square bottom of a
              sandwich loaf, with a darker crust around a pale crumb —
              the old rounded dome looked like an egg or a potato. */}
          <path
            d="M30,64 C16,60 14,38 30,32 C42,20 60,20 70,28 C80,20 98,20 110,32 C126,38 124,60 110,64 L110,136 C110,144 104,148 98,148 L42,148 C36,148 30,144 30,136 Z"
            fill="oklch(66% 0.11 62)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M30,64 C16,60 14,38 30,32 C42,20 60,20 70,28 C80,20 98,20 110,32 C126,38 124,60 110,64 L110,136 C110,144 104,148 98,148 L42,148 C36,148 30,144 30,136 Z"
            fill="oklch(90% 0.06 85)"
            transform="translate(70 86) scale(0.84) translate(-70 -86)"
          />
          <path
            d="M48,40 l4,3 M88,38 l-3,4 M96,118 l4,2 M42,124 l3,-3 M70,134 l4,1"
            stroke="oklch(76% 0.08 75)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "corn":
      return (
        <>
          {/* A wider cob (the eyes used to hang over both edges of the
              narrow one), a real kernel grid, and green husks wrapping
              up from the bottom in place of the two antenna-like lines. */}
          <path
            d="M63,22 C61,14 57,10 52,8 M70,21 L70,6 M77,22 C79,14 83,10 88,8"
            fill="none"
            stroke="oklch(72% 0.1 85)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M70,22 C94,22 108,44 106,76 C104,108 92,140 70,148 C48,140 36,108 34,76 C32,44 46,22 70,22 Z"
            fill="oklch(86% 0.14 95)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M53,30 C46,60 48,104 58,136 M70,24 L70,144 M87,30 C94,60 92,104 82,136 M41,48 C56,54 84,54 99,48 M36,96 C52,102 88,102 104,96 M40,116 C54,122 86,122 100,116"
            fill="none"
            stroke="oklch(72% 0.12 88)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M70,150 C50,150 30,134 26,104 C22,92 22,84 24,76 C30,96 40,116 56,130 C62,136 68,144 70,150 Z M70,150 C90,150 110,134 114,104 C118,92 118,84 116,76 C110,96 100,116 84,130 C78,136 72,144 70,150 Z"
            fill="oklch(62% 0.13 145)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
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
          {/* An actual leaf — pointed tip, a midrib with side veins, and
              a stalk — rather than a plain green disc on a stick. */}
          <path d="M70,124 C68,136 68,144 72,154" stroke={STROKE} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M70,124 C68,136 68,144 72,154" stroke="oklch(52% 0.12 142)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path
            d="M70,18 C78,34 104,44 110,70 C116,96 100,124 70,128 C40,124 24,96 30,70 C36,44 62,34 70,18 Z"
            fill="oklch(60% 0.14 142)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,30 L70,124 M70,52 C60,46 50,46 42,52 M70,52 C80,46 90,46 98,52 M70,96 C58,92 46,96 38,104 M70,96 C82,92 94,96 102,104"
            fill="none"
            stroke="oklch(46% 0.12 142)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "banana":
      return (
        <>
          {/* A half-peeled banana: pale fruit standing up out of a yellow
              peel with two flaps folded down. The old thin crescent left
              the face hanging in mid-air beside it. */}
          <path
            d="M36,114 C22,108 8,116 4,134 C16,130 28,132 42,128 Z M104,114 C118,108 132,116 136,134 C124,130 112,132 98,128 Z"
            fill="oklch(86% 0.15 98)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M36,120 L36,50 C36,26 52,14 70,14 C88,14 104,26 104,50 L104,120 Z"
            fill="oklch(95% 0.05 95)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <circle cx="70" cy="15" r="3.5" fill="oklch(45% 0.07 70)" />
          <path
            d="M50,24 C46,34 45,42 45,50 M90,24 C94,34 95,42 95,50"
            fill="none"
            stroke="oklch(86% 0.07 95)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M33,114 L107,114 C108,134 94,150 70,150 C46,150 32,134 33,114 Z"
            fill="oklch(86% 0.15 98)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M70,118 L70,146" stroke="oklch(72% 0.12 92)" strokeWidth="2.5" strokeLinecap="round" />
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

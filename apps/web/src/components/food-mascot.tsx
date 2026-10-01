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

// Broccoli's florets as [cx, cy, r] — fixed tuples for the same reason
// as GRAPE_CLUSTER above.
const BROCCOLI_FLORETS: Array<[number, number, number]> = [
  [38, 86, 28],
  [102, 86, 28],
  [50, 58, 26],
  [90, 58, 26],
  [70, 46, 26],
  [70, 92, 32],
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
          {/* Three feathery fronds on top (the old tufts were two thin
              slivers), a fuller body that tapers to a point, and the
              little creases a real carrot has. */}
          <path
            d="M70,42 C64,26 66,10 74,2 C82,12 82,28 76,42 Z M62,42 C50,34 42,22 42,8 C54,14 64,24 68,40 Z M80,42 C86,28 96,20 108,16 C106,28 96,38 84,44 Z"
            fill="oklch(62% 0.14 145)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M70,38 C94,38 110,58 106,90 C102,120 86,146 70,154 C54,146 38,120 34,90 C30,58 46,38 70,38 Z"
            fill="oklch(70% 0.18 52)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M38,104 l11,2 M92,116 l-10,3 M48,128 l9,1 M82,136 l-8,2 M96,56 l-9,3 M44,58 l8,3"
            stroke="oklch(56% 0.16 48)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M46,62 C50,52 56,46 64,44" fill="none" stroke="oklch(84% 0.1 70)" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
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
          {/* A slice with a proper rind, white pith and juicy segments,
              plus a leaf — the old one was a flat yellow disc with
              spokes. */}
          <path
            d="M74,38 C78,22 92,14 106,18 C102,32 90,42 74,38 Z"
            fill="oklch(62% 0.14 145)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="70" cy="92" r="56" fill="oklch(80% 0.16 85)" stroke={STROKE} strokeWidth="4.5" />
          <circle cx="70" cy="92" r="47" fill={CREAM} />
          <circle cx="70" cy="92" r="42" fill="oklch(88% 0.15 98)" />
          <path
            d="M70,92 L112,92 M70,92 L100,122 M70,92 L70,134 M70,92 L40,122 M70,92 L28,92 M70,92 L40,62 M70,92 L70,50 M70,92 L100,62"
            stroke={CREAM}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M82,116 l3,5 M56,120 l-2,5 M96,104 l5,2 M42,104 l-5,2"
            stroke="oklch(78% 0.14 92)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "grape":
      return (
        <>
          {/* Same bunch, with a leaf and a woody stem on top and a glint
              on every grape so it reads as round fruit, not flat dots. */}
          <path d="M70,40 C70,28 66,20 58,12" fill="none" stroke={STROKE} strokeWidth="8" strokeLinecap="round" />
          <path d="M70,40 C70,28 66,20 58,12" fill="none" stroke="oklch(52% 0.08 60)" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M70,30 C78,14 98,8 112,16 C108,32 92,40 70,30 Z"
            fill="oklch(62% 0.14 145)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {GRAPE_CLUSTER.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="19" fill="oklch(54% 0.15 300)" stroke={STROKE} strokeWidth="3" />
          ))}
          {GRAPE_CLUSTER.map(([cx, cy]) => (
            <path
              key={`glint-${cx}-${cy}`}
              d={`M${cx - 11},${cy - 4} C${cx - 10},${cy - 10} ${cx - 6},${cy - 13} ${cx - 1},${cy - 13}`}
              fill="none"
              stroke="oklch(80% 0.09 300)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </>
      );
    case "cheese":
      return (
        <>
          {/* A wider wedge in a brighter cheese-yellow, with holes that
              look like holes (darker, not white dots) and a couple
              biting into the edge. */}
          <path
            d="M70,12 C92,40 114,92 124,136 C126,146 120,152 110,152 L30,152 C20,152 14,146 16,136 C26,92 48,40 70,12 Z"
            fill="oklch(86% 0.15 92)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="128" r="8" fill="oklch(74% 0.14 85)" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="92" cy="132" r="7" fill="oklch(74% 0.14 85)" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="70" cy="40" r="6" fill="oklch(74% 0.14 85)" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="104" cy="106" r="5" fill="oklch(74% 0.14 85)" stroke={STROKE} strokeWidth="2.2" />
          <circle cx="34" cy="108" r="4" fill="oklch(74% 0.14 85)" stroke={STROKE} strokeWidth="2.2" />
          <path d="M60,36 C56,44 52,52 49,60" fill="none" stroke={CREAM} strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
        </>
      );
    case "mug":
      return (
        <>
          {/* A coloured mug with coffee showing at the rim and curlier
              steam — the old one was a white cup on a (usually) white
              card, with a brown stripe standing in for the coffee. */}
          <path
            d="M48,34 C42,26 54,22 48,12 M70,32 C64,24 76,20 70,8 M92,34 C86,26 98,22 92,12"
            fill="none"
            stroke="oklch(72% 0.02 150)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path d="M106,74 C132,70 134,112 104,110" fill="none" stroke={STROKE} strokeWidth="13" strokeLinecap="round" />
          <path d="M106,74 C132,70 134,112 104,110" fill="none" stroke="oklch(65% 0.13 290)" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M24,50 L116,50 L109,138 C108,144 103,148 97,148 L43,148 C37,148 32,144 31,138 Z"
            fill="oklch(65% 0.13 290)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <ellipse cx="70" cy="50" rx="46" ry="9" fill="oklch(40% 0.07 50)" stroke={STROKE} strokeWidth="4" />
          <path d="M44,49 C54,46 66,45 78,46" fill="none" stroke="oklch(58% 0.08 55)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36,128 C52,138 88,138 104,128" fill="none" stroke="oklch(80% 0.08 290)" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "broccoli":
      return (
        <>
          {/* One bumpy cloud of florets (every circle is drawn twice —
              outlined, then filled again without an outline — so the
              outlines only show around the outside, not as lines across
              the face), on a pale green stalk. */}
          <path
            d="M56,110 L56,140 C56,148 62,152 70,152 C78,152 84,148 84,140 L84,110 Z"
            fill="oklch(82% 0.1 135)"
            stroke={STROKE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {BROCCOLI_FLORETS.map(([cx, cy, r]) => (
            <circle key={`o-${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="oklch(58% 0.15 148)" stroke={STROKE} strokeWidth="4.5" />
          ))}
          {BROCCOLI_FLORETS.map(([cx, cy, r]) => (
            <circle key={`f-${cx}-${cy}`} cx={cx} cy={cy} r={r - 2} fill="oklch(58% 0.15 148)" />
          ))}
          <path
            d="M26,74 c4,-5 10,-5 13,0 M94,40 c4,-4 9,-4 12,0 M104,96 c3,-4 8,-4 11,0 M48,34 c4,-4 9,-4 12,0 M24,98 c3,-3 7,-3 9,0 M72,26 c3,-3 7,-3 9,0"
            fill="none"
            stroke="oklch(44% 0.12 148)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "fish":
      return (
        <>
          {/* A brighter fish with a curved, forked tail, a proper back
              fin, a few scales and a couple of bubbles. */}
          <circle cx="16" cy="38" r="5" fill="none" stroke="oklch(72% 0.1 225)" strokeWidth="2.5" />
          <circle cx="28" cy="22" r="3.5" fill="none" stroke="oklch(72% 0.1 225)" strokeWidth="2.5" />
          <path
            d="M102,72 C116,64 126,52 134,40 C133,58 127,76 127,88 C127,100 133,118 134,136 C126,124 116,112 102,104 Z"
            fill="oklch(62% 0.13 235)"
            stroke={STROKE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M48,48 C52,30 68,22 86,24 C82,34 82,42 86,50 Z"
            fill="oklch(62% 0.13 235)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <ellipse cx="62" cy="88" rx="52" ry="46" fill="oklch(74% 0.12 225)" stroke={STROKE} strokeWidth="4.5" />
          <path
            d="M18,104 C34,128 84,134 106,110 C88,120 42,120 18,104 Z"
            fill="oklch(88% 0.06 220)"
            opacity="0.8"
          />
          <path
            d="M92,62 c6,4 6,11 0,15 M100,82 c6,4 6,11 0,15 M90,100 c5,3 5,9 0,12"
            fill="none"
            stroke="oklch(58% 0.12 232)"
            strokeWidth="2.5"
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
          {/* Third attempt at a shrimp. What makes one recognisable is the
              curl, so the body is a fat comma: a big round head end (wide
              enough to carry the face) sweeping down into a tail that
              hooks back up on the left and ends in a two-lobed fan.
              Shell bands follow the curve and two feelers sweep back
              off the head. */}
          <path
            d="M88,34 C92,18 106,8 124,8 M80,32 C80,14 92,2 110,-2"
            fill="none"
            stroke="oklch(58% 0.15 32)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M28,110 C16,102 8,92 4,80 C0,94 2,106 10,114 C2,120 -2,130 0,142 C10,138 22,132 32,124 Z"
            fill="oklch(64% 0.17 30)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M74,30 C102,30 120,54 116,84 C112,112 94,134 70,142 C50,148 30,142 20,126 C16,118 20,108 28,108 C36,116 46,118 52,112 C38,102 28,84 30,68 C34,44 52,30 74,30 Z"
            fill="oklch(76% 0.14 35)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M44,46 C58,54 90,54 104,44 M110,104 C98,102 88,110 84,124 M80,138 C76,128 68,122 58,122 M46,144 C46,136 42,130 34,126"
            fill="none"
            stroke="oklch(60% 0.16 32)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M38,62 C40,52 46,44 54,40" fill="none" stroke="oklch(88% 0.08 45)" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
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
          {/* A whole bulb: pointed papery neck, cloves bulging along the
              bottom, faint purple streaks and a few root hairs — and
              clearly not the onion (golden, green sprout) next to it. */}
          <path d="M61,144 l-3,8 M70,146 l0,9 M79,144 l3,8" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M70,14 C72,32 78,42 90,50 C108,62 116,88 108,112 C102,132 92,146 82,142 C78,150 62,150 58,142 C48,146 38,132 32,112 C24,88 32,62 50,50 C62,42 68,32 70,14 Z"
            fill="oklch(96% 0.012 85)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,26 C62,60 60,110 62,140 M70,26 C78,60 80,110 78,140 M52,52 C40,80 40,112 50,134 M88,52 C100,80 100,112 90,134"
            fill="none"
            stroke="oklch(78% 0.06 320)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
    case "mushroom":
      return (
        <>
          {/* A bigger, rounder brown cap with pale spots and a hint of
              gills, on a chunkier stalk wide enough for the smile. */}
          <path
            d="M52,94 L50,136 C50,146 58,152 70,152 C82,152 90,146 90,136 L88,94 Z"
            fill="oklch(94% 0.02 85)"
            stroke={STROKE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M16,84 C16,48 40,24 70,24 C100,24 124,48 124,84 C124,92 118,97 108,97 L32,97 C22,97 16,92 16,84 Z"
            fill="oklch(66% 0.09 55)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <ellipse cx="42" cy="46" rx="8" ry="6" fill="oklch(88% 0.04 75)" transform="rotate(-30 42 46)" />
          <ellipse cx="72" cy="36" rx="7" ry="5" fill="oklch(88% 0.04 75)" />
          <ellipse cx="102" cy="50" rx="8" ry="6" fill="oklch(88% 0.04 75)" transform="rotate(30 102 50)" />
          <circle cx="26" cy="70" r="4" fill="oklch(88% 0.04 75)" />
          <circle cx="114" cy="74" r="4" fill="oklch(88% 0.04 75)" />
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
          {/* A pear-shaped half (narrow top, wide bottom) with the stone
              sitting low like a round belly — it used to sit dead centre
              behind the face and read as a big brown nose. */}
          <path
            d="M70,20 C88,22 98,42 100,58 C104,78 116,92 116,112 C116,136 96,152 70,152 C44,152 24,136 24,112 C24,92 36,78 40,58 C42,42 52,22 70,20 Z"
            fill="oklch(50% 0.11 140)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M70,20 C88,22 98,42 100,58 C104,78 116,92 116,112 C116,136 96,152 70,152 C44,152 24,136 24,112 C24,92 36,78 40,58 C42,42 52,22 70,20 Z"
            fill="oklch(88% 0.13 118)"
            transform="translate(70 92) scale(0.84) translate(-70 -92)"
          />
          <circle cx="70" cy="126" r="14" fill="oklch(52% 0.12 50)" stroke={STROKE} strokeWidth="3" />
          <path d="M63,121 C65,118 68,116 72,116" fill="none" stroke="oklch(72% 0.1 60)" strokeWidth="3" strokeLinecap="round" />
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
          {/* A real apple outline — dimple at the top, two soft lobes at
              the bottom — with a glossy highlight, where it used to be a
              plain red oval. */}
          <path d="M70,54 C68,40 70,28 78,18" stroke={STROKE} strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M70,54 C68,40 70,28 78,18" stroke="oklch(48% 0.08 60)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path
            d="M76,30 C84,16 100,12 112,20 C104,32 90,38 76,30 Z"
            fill="oklch(62% 0.14 145)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M70,52 C60,40 38,40 28,60 C18,82 28,126 48,142 C58,150 64,148 70,144 C76,148 82,150 92,142 C112,126 122,82 112,60 C102,40 80,40 70,52 Z"
            fill="oklch(60% 0.2 25)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path d="M36,70 C38,60 44,54 52,50" fill="none" stroke="oklch(82% 0.1 30)" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        </>
      );
    case "chocolate":
      return (
        <>
          {/* A bar half out of its wrapper: squares of chocolate on top,
              a torn foil edge, and a red wrapper below — no more grid
              lines ruled straight across the face. */}
          <rect x="28" y="24" width="84" height="110" rx="8" fill="oklch(40% 0.08 45)" stroke={STROKE} strokeWidth="4.5" />
          <path
            d="M56,26 L56,60 M84,26 L84,58 M30,52 L110,52"
            stroke="oklch(30% 0.06 40)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M34,32 L50,32 M62,32 L78,32 M90,32 L104,32"
            stroke="oklch(54% 0.08 50)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M26,126 L114,126 L114,142 C114,148 110,152 104,152 L36,152 C30,152 26,148 26,142 Z"
            fill="oklch(62% 0.19 25)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M24,128 L32,118 L40,126 L48,116 L56,126 L64,116 L72,126 L80,116 L88,126 L96,116 L104,126 L112,118 L116,128 Z"
            fill="oklch(92% 0.01 250)"
            stroke={STROKE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M36,141 L104,141" stroke="oklch(86% 0.12 90)" strokeWidth="4" strokeLinecap="round" />
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
          <path d="M30,62 C34,50 44,42 56,38" fill="none" stroke="oklch(82% 0.1 30)" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        </>
      );
  }
}

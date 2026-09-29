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
  | "beef";

// Keyword match, checked first against the recipe's actual ingredient
// names (the real "what's this dish made of" signal) and only falling
// back to its title + description if nothing in the ingredient list
// matches — see inferFoodKind below. Order matters within each pass:
// first match wins, so more distinctive/defining words are checked
// before generic ones — proteins in particular are checked ahead of
// things like "pepper" or "cheese" that are just as likely to show up
// as a minor ingredient in a dish some other protein actually defines.
// Falls back to the original tomato for anything that doesn't match a
// known ingredient.
const KIND_PATTERNS: Array<[FoodKind, RegExp]> = [
  ["egg", /\begg(s)?\b/i],
  ["chicken", /\b(chicken|turkey|poultry)\b/i],
  ["beef", /\b(beef|steak|pork|bacon|ham|sausage|lamb|meatballs?|ground meat)\b/i],
  ["fish", /\b(fish|salmon|tuna|cod|tilapia|trout|halibut|shrimp|prawns?|scallops?|crab|anchov(y|ies))\b/i],
  ["carrot", /\bcarrots?\b/i],
  ["citrus", /\b(lemons?|limes?|oranges?|citrus|grapefruit)\b/i],
  ["grape", /\b(grapes?|wine)\b/i],
  ["cheese", /\b(cheese|parmesan|mozzarella|cheddar|feta|ricotta)\b/i],
  ["mug", /\b(coffee|espresso|latte|tea|mug)\b/i],
  ["broccoli", /\bbroccoli\b/i],
  ["pepper", /\b(peppers?|chil(i|e|li)(es)?|jalape[nñ]os?|capsicum)\b/i],
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
          <ellipse cx="70" cy="92" rx="44" ry="58" fill={CREAM} stroke={STROKE} strokeWidth="4.5" />
          <ellipse cx="48" cy="62" rx="12" ry="9" fill="oklch(80% 0.15 95)" stroke={STROKE} strokeWidth="1.8" opacity="0.85" />
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
          <circle cx="55" cy="100" r="6" fill={CREAM} />
          <circle cx="80" cy="118" r="5" fill={CREAM} />
          <circle cx="66" cy="130" r="4" fill={CREAM} />
        </>
      );
    case "mug":
      return (
        <>
          <path d="M112,76 C136,76 136,112 112,112" fill="none" stroke={STROKE} strokeWidth="4.5" />
          <rect x="24" y="48" width="90" height="96" rx="14" fill={CREAM} stroke={STROKE} strokeWidth="4.5" />
          <path d="M28,72 L110,72" stroke="oklch(45% 0.08 50)" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
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
          <path
            d="M74,34 C104,36 122,62 122,92 C122,122 104,148 74,150 C46,150 24,126 20,92 C24,58 46,34 74,34 Z"
            fill="oklch(72% 0.1 220)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M20,92 L2,70 L4,92 L2,114 Z"
            fill="oklch(72% 0.1 220)"
            stroke={STROKE}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M44,68 C54,63 64,63 72,68 M40,110 C52,117 66,117 78,110"
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
          <path
            d="M70,34 C46,34 30,54 32,80 C34,108 50,130 74,132 C96,134 112,116 112,92 C112,64 96,34 70,34 Z"
            fill="oklch(70% 0.12 55)"
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <path
            d="M60,131 C57,140 58,147 65,152"
            fill="none"
            stroke="oklch(90% 0.015 85)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <ellipse cx="67" cy="152" rx="9" ry="5.5" fill="oklch(90% 0.015 85)" stroke={STROKE} strokeWidth="2.5" />
          <path d="M52,72 L64,80 M88,72 L76,80" stroke="oklch(54% 0.1 55)" strokeWidth="2.5" strokeLinecap="round" />
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
          <path
            d="M38,60 L96,104 M46,96 L100,58 M32,80 L82,116"
            stroke="oklch(36% 0.1 30)"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.75"
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

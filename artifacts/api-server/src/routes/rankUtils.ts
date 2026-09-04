// Elite FF Rank Progression System
// Blaze 0-149, Striker 150-299, Predator 300-499, Phantom 500-749
// Nexus 750-999, Nova 1000-1249, Supreme 1250-1499, Legend 1500-1699
// Apex 1700-1999 (₹300 reward on first reach), Elite 2000+ (prestige loop)

export const RANK_TIERS = [
  { name: "Blaze", emoji: "\ud83d\udd25", min: 0, max: 149, color: "#ff6b35" },
  { name: "Striker", emoji: "\u2694\ufe0f", min: 150, max: 299, color: "#f59e0b" },
  { name: "Predator", emoji: "\ud83d\udc3a", min: 300, max: 499, color: "#dc2626" },
  { name: "Phantom", emoji: "\ud83d\udc64", min: 500, max: 749, color: "#818cf8" },
  { name: "Nexus", emoji: "\u26a1", min: 750, max: 999, color: "#a855f7" },
  { name: "Nova", emoji: "\u2728", min: 1000, max: 1249, color: "#ec4899" },
  { name: "Supreme", emoji: "\ud83d\udc51", min: 1250, max: 1499, color: "#fbbf24" },
  { name: "Legend", emoji: "\u2b50", min: 1500, max: 1699, color: "#f59e0b" },
  { name: "Apex", emoji: "\ud83c\udfd4\ufe0f", min: 1700, max: 1999, color: "#22c55e" },
  { name: "Elite", emoji: "\ud83d\udc8e", min: 2000, color: "#38bdf8" },
] as const;

export function getRankFromPoints(points: number): string {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (points >= RANK_TIERS[i].min) return RANK_TIERS[i].name;
  }
  return "Blaze";
}

export function getRankColor(rank: string): string {
  return RANK_TIERS.find(t => t.name === rank)?.color || "#ff6b35";
}

export function getRankEmoji(rank: string): string {
  return RANK_TIERS.find(t => t.name === rank)?.emoji || "\ud83d\udd25";
}

// Point shifts per the user's spec:
// Winner: +50 | 2nd: +30 | 3rd: +20 | Participation: +5
// No Show: -10 | Lost 3 in a row: -50 | Disqualified: -100 | Cheating: -200 (ban)
export function getPointsForOutcome(outcome: string | null, _kills: number = 0): number {
  switch (outcome) {
    case "won": return 50;
    case "2nd": return 30;
    case "3rd": return 20;
    case "completed": return 5;
    case "no-show": return -10;
    case "lost-3-streak": return -50;
    case "disqualified": return -100;
    case "cheating": return -200;
    default: return 5;
  }
}

export function getRankDescription(rank: string): string {
  const d: Record<string, string> = {
    Blaze: "Starting rank for all players",
    Striker: "Getting warmed up on the battlefield",
    Predator: "Hunting for top placements",
    Phantom: "Moving like a shadow through lobbies",
    Nexus: "The turning point between good and elite",
    Nova: "Exploding into the upper echelon",
    Supreme: "One of the best in the arena",
    Legend: "A name that others fear in tournaments",
    Apex: "At the summit \u2014 one step from Elite",
    Elite: "The top rank. Prestige loop activates at 2000+",
  };
  return d[rank] || "";
}

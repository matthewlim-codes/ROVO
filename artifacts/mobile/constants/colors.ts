/**
 * Rovo — Uber-inspired design tokens
 *
 * Primary: near-black (#0A0A0A) — commands attention, signals trust
 * Background: soft off-white (#F6F6F6) — airy, light, familiar
 * Accent: confident green (#22C55E) — matches, success, "go"
 * Surface: pure white cards with subtle shadows
 */

const colors = {
  light: {
    text: "#0A0A0A",
    tint: "#22C55E",

    // Core surfaces
    background: "#F6F6F6",
    foreground: "#0A0A0A",

    // Cards / elevated surfaces
    card: "#FFFFFF",
    cardForeground: "#0A0A0A",

    // Primary action — near-black like Uber
    primary: "#0A0A0A",
    primaryForeground: "#FFFFFF",

    // Secondary — dark charcoal for secondary actions
    secondary: "#1C1C1C",
    secondaryForeground: "#FFFFFF",

    // Muted / subdued elements
    muted: "#F0F0F0",
    mutedForeground: "#8A8A8A",

    // Accent — Uber-green for matches/success/CTAs
    accent: "#22C55E",
    accentForeground: "#FFFFFF",

    // Subtle green tint for backgrounds
    accentSurface: "#F0FDF4",
    accentBorder: "#86EFAC",

    // Destructive
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    // Borders and inputs — very subtle
    border: "#EBEBEB",
    input: "#F0F0F0",

    // Additional semantic
    success: "#22C55E",
    successForeground: "#FFFFFF",

    // Separator
    separator: "#E8E8E8",

    // Overlay (for bottom sheets / modals)
    overlay: "rgba(0,0,0,0.4)",
  },

  radius: 14,
};

export default colors;

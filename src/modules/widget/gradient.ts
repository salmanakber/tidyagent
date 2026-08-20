export const GRADIENT_ANGLES = [
  { id: "to-bottom-right", label: "Diagonal, down right" },
  { id: "to-bottom-left", label: "Diagonal, down left" },
  { id: "to-right", label: "Left to right" },
  { id: "to-bottom", label: "Top to bottom" },
  { id: "radial", label: "From the corner" },
] as const;

export type GradientAngle = (typeof GRADIENT_ANGLES)[number]["id"];

export function widgetGradientCss(from: string, to: string, angle?: string | null) {
  if (angle === "radial") return `radial-gradient(circle at 18% 18%, ${from} 0%, ${to} 82%)`;
  const deg =
    angle === "to-right" ? "90deg" : angle === "to-bottom" ? "180deg" : angle === "to-bottom-left" ? "225deg" : "135deg";
  return `linear-gradient(${deg}, ${from} 0%, ${to} 100%)`;
}

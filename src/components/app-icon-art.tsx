// The ede. app icon: the logo's lime dot with its soft halo, on near-black.
// Drawn with inline styles so Next.js can render it to PNG (next/og) at any
// size. The dot sits well inside the safe zone, so Android can crop the icon
// to a circle or squircle without clipping it.
export const ICON_BACKGROUND = "#0b0c0e";
const LIME = "#b5f745";

export function AppIconArt({ size }: { size: number }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: ICON_BACKGROUND }}>
      <div
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: "50%",
          background: "rgba(181, 247, 69, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: size * 0.31, height: size * 0.31, borderRadius: "50%", background: LIME }} />
      </div>
    </div>
  );
}

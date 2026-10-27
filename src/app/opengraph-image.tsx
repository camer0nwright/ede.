import { ImageResponse } from "next/og";

// The picture shown when a link to ede. is shared (SPEC decision 63).
export const alt = "ede. — Train for all of you. A running and strength plan that changes when life does.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f3f2ec", color: "#141610", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(217,255,67,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: "#d9ff43" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>ede.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 112, lineHeight: 1, letterSpacing: -5, fontWeight: 600 }}>Train for all of you.</div>
          <div style={{ fontSize: 34, color: "#66695f", maxWidth: 900 }}>A running and strength plan that knows your goals and changes when life does.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, color: "#66695f" }}>trainwithede.com</div>
          <div style={{ background: "#d9ff43", padding: "16px 28px", fontSize: 26, fontWeight: 600 }}>Build my plan →</div>
        </div>
      </div>
    ),
    size,
  );
}

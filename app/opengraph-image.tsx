import { ImageResponse } from "next/og";

export const alt = "Skill Supermarket - AI Skill Discovery & Evaluation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#faf8f3",
        color: "#151a28",
        padding: "72px 82px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 34, fontWeight: 800 }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, background: "#151a28", display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 5, padding: 12 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "#ff5b2d" }} />
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "#ff7651" }} />
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "#ff7651" }} />
          <span style={{ width: 14, height: 14, borderRadius: 4, background: "#ff5b2d" }} />
        </div>
        Skill <span style={{ color: "#f45a2a" }}>Supermarket</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ maxWidth: 960, fontSize: 76, lineHeight: 1.08, letterSpacing: -3, fontWeight: 900 }}>
          Discover AI skills you can trust.
        </div>
        <div style={{ fontSize: 30, color: "#697184" }}>
          Evidence-based reviews for Skills, MCP Servers and Agent Packs.
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 23, color: "#697184" }}>
        <span>skillsupermarket.com</span>
        <span>Evaluation · Security · Trends</span>
      </div>
    </div>,
    size,
  );
}

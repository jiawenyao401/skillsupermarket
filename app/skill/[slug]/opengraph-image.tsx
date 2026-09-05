import { ImageResponse } from "next/og";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { evaluations, skills } from "@/lib/schema";
import { bufferPngResponse } from "@/lib/og-image";

export const alt = "Skill Supermarket evaluation report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

function fallbackImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#faf8f3", color: "#151a28", padding: "72px 82px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>Skill <span style={{ color: "#f45a2a" }}>Supermarket</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontSize: 72, lineHeight: 1.08, fontWeight: 900 }}>Evidence-based Skill evaluation</div>
        <div style={{ color: "#697184", fontSize: 30 }}>Security · Documentation · Quality · Activity · Adoption</div>
      </div>
      <div style={{ fontSize: 23, color: "#697184" }}>skillsupermarket.com</div>
    </div>,
    size,
  );
}

function skillImage({
  name,
  type,
  score,
  evaluated,
}: {
  name: string;
  type: string;
  score: string;
  evaluated: boolean;
}) {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#faf8f3", color: "#151a28", padding: "64px 72px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 800 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "#151a28", display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 4, padding: 11 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ff5b2d" }} />
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ff7651" }} />
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ff7651" }} />
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ff5b2d" }} />
          </div>
          Skill <span style={{ color: "#f45a2a" }}>Supermarket</span>
        </div>
        <div style={{ border: "2px solid #e2ddd4", borderRadius: 999, padding: "10px 20px", color: "#697184", fontSize: 22 }}>{type}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 52 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860 }}>
          <div style={{ color: "#f45a2a", fontSize: 23, fontWeight: 800, letterSpacing: 3 }}>EVIDENCE-BASED EVALUATION</div>
          <div style={{ fontSize: name.length > 28 ? 62 : 78, lineHeight: 1.03, fontWeight: 900, letterSpacing: -3 }}>{name}</div>
          <div style={{ color: "#697184", fontSize: 27 }}>Security · Documentation · Quality · Activity · Adoption</div>
        </div>
        <div style={{ width: 190, height: 190, flexShrink: 0, borderRadius: 40, background: "#151a28", color: "#faf8f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 74, fontWeight: 900, letterSpacing: -4 }}>{score}</div>
          <div style={{ color: "#ff7651", fontSize: 20, fontWeight: 700 }}>{evaluated ? "SCORE / 100" : "PENDING"}</div>
        </div>
      </div>
      <div style={{ fontSize: 22, color: "#697184" }}>skillsupermarket.com</div>
    </div>,
    size,
  );
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const [skill] = await db.select({ id: skills.id, name: skills.name, type: skills.type })
      .from(skills).where(eq(skills.slug, slug)).limit(1);
    const [evaluation] = skill
      ? await db.select({ overallScore: evaluations.overallScore })
        .from(evaluations).where(eq(evaluations.skillId, skill.id))
        .orderBy(desc(evaluations.evaluatedAt)).limit(1)
      : [];

    const name = skill?.name ?? "AI Skill";
    const type = skill?.type === "mcp-server" ? "MCP Server" : skill?.type === "agent-pack" ? "Agent Pack" : "AI Skill";
    // Satori treats numeric React children as multiple layout nodes in this
    // dynamic route. Normalize the score to text before image rendering.
    const score = evaluation ? String(evaluation.overallScore) : "—";

    return await bufferPngResponse(skillImage({
      name,
      type,
      score,
      evaluated: Boolean(evaluation),
    }));
  } catch (error) {
    const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80);
    const cause = error instanceof Error ? error.name : "UnknownError";
    console.warn(`[og-image] fallback slug=${safeSlug} cause=${cause}`);
    return bufferPngResponse(fallbackImage());
  }
}

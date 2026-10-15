import { ImageResponse } from "next/og";
import { siteName } from "@/components/marketing/data/site";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#101113",
        color: "#F0EFEB",
        padding: 64,
        fontFamily: "sans-serif",
        gap: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              background: "#efeee9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#101113",
              fontSize: 24,
            }}
          >
            C
          </div>
          {siteName}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 15, letterSpacing: 2, color: "#A6A8AE" }}>
            A WORKSPACE FOR VIDEO PRODUCTION
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: -4,
            }}
          >
            <span>Good ideas.</span>
            <span style={{ color: "#A4A6AD" }}>Ready for the cut.</span>
          </div>
        </div>
        <div style={{ color: "#A6A8AE", fontSize: 22 }}>
          Your script. Every scene. The final say.
        </div>
      </div>
      <div
        style={{
          width: 290,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#E7DFCC",
          color: "#333C30",
          padding: 28,
          borderRadius: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          FIELDWORK
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 48,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          <span>Made for</span>
          <span style={{ fontStyle: "italic", fontFamily: "serif" }}>
            the everyday.
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {["#B65C34", "#C39972", "#343D2F"].map((color) => (
            <div
              key={color}
              style={{
                display: "flex",
                flex: 1,
                height: 130,
                background: color,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 13 }}>A little less disposable.</div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}

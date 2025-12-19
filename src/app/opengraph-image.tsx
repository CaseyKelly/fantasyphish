import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "FantasyPhish - Predict the Setlist";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2d4654",
          gap: 40,
        }}
      >
        {/* Donut Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="200"
            height="200"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="60"
              cy="60"
              r="40"
              stroke="#c23a3a"
              strokeWidth="24"
              fill="none"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            FantasyPhish
          </div>
          <div
            style={{
              fontSize: 40,
              color: "#94a3b8",
            }}
          >
            Predict the Setlist
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

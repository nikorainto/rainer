import { ImageResponse } from "next/og";

export const alt = "Rainer. Live radar at one pin, for the past hour and the next.";
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
        background: "#061018",
        padding: "72px",
      }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 32 32"
        role="img"
        aria-label="Rainer"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Rainer</title>
        <path
          d="M16 5.5c3.6 4.4 7.2 8.1 7.2 12.4a7.2 7.2 0 1 1-14.4 0C8.8 13.6 12.4 9.9 16 5.5Z"
          fill="#3ee0b0"
        />
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 92, fontWeight: 600, color: "#e7f0f7", lineHeight: 1 }}>Rainer</div>
        <div style={{ marginTop: 20, fontSize: 36, color: "#8aa0b4" }}>Live radar at one pin</div>
      </div>
    </div>,
    { ...size },
  );
}

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#061018",
      }}
    >
      <svg
        width="112"
        height="112"
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
    </div>,
    { ...size },
  );
}

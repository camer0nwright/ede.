import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

// The icon iPhones and iPads use when ede. is added to the home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={size.width} />, size);
}

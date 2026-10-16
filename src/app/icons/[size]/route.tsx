import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

// PNG icons for the web app manifest (Android home screens and installs).
const ICON_SIZES = [192, 512] as const;

export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const size = Number((await params).size.replace(/\.png$/, ""));
  if (!ICON_SIZES.includes(size as (typeof ICON_SIZES)[number])) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIconArt size={size} />, { width: size, height: size });
}

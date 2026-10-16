import type { MetadataRoute } from "next";
import { ICON_BACKGROUND } from "@/components/app-icon-art";

// Makes ede. installable: home-screen name and icon, and opening full-screen
// like an app rather than in a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ede.",
    short_name: "ede.",
    description: "A hybrid training coach for people who lift and run.",
    start_url: "/",
    display: "standalone",
    background_color: ICON_BACKGROUND,
    theme_color: ICON_BACKGROUND,
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

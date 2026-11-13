import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zonkey — Daily Word Association Game",
    short_name: "Zonkey",
    description: "Meet the AI in the middle. A daily word association game.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12081a",
    theme_color: "#120b22",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

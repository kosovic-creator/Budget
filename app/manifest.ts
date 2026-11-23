import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moj budžet",
    short_name: "Budžet",
    description: "Lični pregled stanja, troškova i pretplata.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#f6f7f8",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moj budžet",
    short_name: "Budžet",
    description: "Lični pregled stanja, troškova i pretplata.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#202124",
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

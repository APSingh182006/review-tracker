import { createFileRoute } from "@tanstack/react-router";
import { TrackerApp } from "@/components/tracker/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Project Review Tracker — Student groups & reviews" },
      { name: "description", content: "Track student project groups, five-stage reviews, marks and final submissions across class sections." },
      { property: "og:title", content: "Project Review Tracker" },
      { property: "og:description", content: "Track student project groups, reviews, marks and final submissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackerApp,
});

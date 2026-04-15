"use client";
// Step 1 is implemented as a self-contained JSX component.
// Import it directly until we split into sub-components in later steps.
import dynamic from "next/dynamic";

const VirtualGenderRevealApp = dynamic(
  () => import("@/components/cinema/CinematicEntry"),
  { ssr: false }
);

export default function Home() {
  return <VirtualGenderRevealApp />;
}

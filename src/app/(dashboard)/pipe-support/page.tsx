import { Suspense } from "react";
import SupportCalculator from "@/components/pipe-support/SupportCalculator";

export const metadata = { title: "Pipe Support Calculator — PipeField OS" };

export default function PipeSupportPage() {
  return (
    <Suspense>
      <SupportCalculator />
    </Suspense>
  );
}

// This page renders inside (dashboard)/layout.tsx which wraps it in DashboardShell
// automatically — no need to import DashboardShell here.

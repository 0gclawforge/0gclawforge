"use client";

import dynamic from "next/dynamic";

const AppClient = dynamic(() => import("./AppClient"), { ssr: false });

export default function AppPage() {
  return <AppClient />;
}

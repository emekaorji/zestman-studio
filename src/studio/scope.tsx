"use client";

import { createContext, useContext } from "react";
import { LOCAL_ORG } from "@/lib/slugs";

/** Which org and project the current URL names. */
export interface Scope {
  org: string;
  /** null on `/<org>`, where the studio picks a project and corrects the URL. */
  projectSlug: string | null;
}

const ScopeContext = createContext<Scope>({ org: LOCAL_ORG, projectSlug: null });

export function ScopeProvider({ value, children }: { value: Scope; children: React.ReactNode }) {
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): Scope {
  return useContext(ScopeContext);
}

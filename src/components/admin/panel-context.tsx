"use client";

import { createContext, useContext } from "react";

/**
 * Which back-office panel a shared screen sits in: the admin panel (/admin)
 * or the front-desk staff panel (/admin/team). Links and admin-only buttons
 * follow it.
 */
type Panel = { base: string; role: "admin" | "staff" };

const PanelContext = createContext<Panel>({ base: "/admin", role: "admin" });

export function PanelProvider({ base, role, children }: Panel & { children: React.ReactNode }) {
  return <PanelContext.Provider value={{ base, role }}>{children}</PanelContext.Provider>;
}

export const usePanel = () => useContext(PanelContext);

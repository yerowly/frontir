import { createContext, useContext } from "react";

export const NARROW_MAX = 768;

export const LayoutCtx = createContext({ narrow: false });

export function useLayout() {
  return useContext(LayoutCtx);
}

export function padPage(narrow) {
  return narrow ? "12px 14px 24px" : "20px 28px 40px";
}

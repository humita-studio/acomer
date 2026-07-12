import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribeMobile(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getIsMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

/** SSR / primer paint del server: asumir desktop para evitar mismatch. */
function getServerIsMobile() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeMobile, getIsMobile, getServerIsMobile)
}

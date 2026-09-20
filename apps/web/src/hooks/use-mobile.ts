import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < MOBILE_BREAKPOINT
    }
    return false
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      const onChange = () => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      }
      mql.addEventListener("change", onChange)
      checkMobile()
      return () => mql.removeEventListener("change", onChange)
    } else {
      window.addEventListener("resize", checkMobile)
      checkMobile()
      return () => window.removeEventListener("resize", checkMobile)
    }
  }, [])

  return !!isMobile
}

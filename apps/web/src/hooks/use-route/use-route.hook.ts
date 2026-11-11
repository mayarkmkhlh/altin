import { useCallback, useEffect, useState } from "react";

export type Tab = "circle" | "assistant" | "approvals" | "activity";
export type Route = { circleId: string | null; tab: Tab };

const TABS: Tab[] = ["circle", "assistant", "approvals", "activity"];

// / and /new              -> a new circle, in the assistant (the app sends / to the last circle if there is one)
// /circles/:id            -> the circle board
// /circles/:id/:tab       -> assistant, approvals or activity for that circle
export function parseRoute(pathname: string): Route {
  const match = /^\/circles\/([0-9a-f-]{36})(?:\/(\w+))?\/?$/i.exec(pathname);
  if (!match) return { circleId: null, tab: "assistant" };
  const tab = TABS.find((t) => t === match[2]) ?? "circle";
  return { circleId: match[1]!, tab };
}

export function routePath(route: Route): string {
  if (!route.circleId) return "/new";
  return route.tab === "circle" ? `/circles/${route.circleId}` : `/circles/${route.circleId}/${route.tab}`;
}

const LAST_CIRCLE_KEY = "altin:last-circle";

function initialRoute(): Route {
  const route = parseRoute(window.location.pathname);
  const last = localStorage.getItem(LAST_CIRCLE_KEY);
  if (window.location.pathname === "/" && last) {
    const resumed: Route = { circleId: last, tab: "circle" };
    window.history.replaceState(null, "", routePath(resumed));
    return resumed;
  }
  return route;
}

export function forgetLastCircle(): void {
  localStorage.removeItem(LAST_CIRCLE_KEY);
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(initialRoute);

  useEffect(() => {
    if (route.circleId) localStorage.setItem(LAST_CIRCLE_KEY, route.circleId);
  }, [route.circleId]);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: Route) => {
    const path = routePath(next);
    if (path !== window.location.pathname) window.history.pushState(null, "", path);
    setRoute(next);
    window.scrollTo(0, 0);
  }, []);

  return [route, navigate];
}

/**
 * Page titles and link-preview tags only exist on the web (RouteHead.web.tsx).
 * Native apps have no document head, so this renders nothing.
 */
export function RouteHead() {
  return null;
}

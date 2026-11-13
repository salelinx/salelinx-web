// The admin console's light / dark / system choice. A plain module (not
// "use client") so the server layout can inline the script and the client
// toggle can share the key. See the dark mode block in app/admin/admin.css.
//
// localStorage, never a cookie: a cookie would belong in the privacy policy's
// cookie inventory (CLAUDE.md "There is no theme toggle"), and the choice only
// matters to this browser. Admin-only; the public site has no theme switch.

export const ADMIN_THEME_KEY = "slx-admin-theme";

export type AdminThemeChoice = "light" | "dark" | "system";

/**
 * Runs in <head> before first paint, so a light-mode admin never sees the
 * dark default flash first. Keep in step with applyAdminTheme in
 * AdminThemeToggle.tsx. Dark when nothing is saved.
 */
export const ADMIN_THEME_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  ADMIN_THEME_KEY,
)});var l=c==="light"||(c==="system"&&!window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-admin-theme",l?"light":"dark")}catch(e){}})();`;

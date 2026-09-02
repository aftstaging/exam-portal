import { openLoginDialog } from "@/_core/auth/loginBus";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Start the local sign-in flow. Opens the LoginDialog with the sign-in form.
 * `open` is a module-level UI event, so this is safe to call from event
 * handlers without side effects on render.
 */
export const startLogin = (mode: "login" | "register" = "login") =>
  openLoginDialog(mode);

export { openLoginDialog, closeLoginDialog } from "@/_core/auth/loginBus";

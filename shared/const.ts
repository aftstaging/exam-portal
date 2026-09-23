export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

export const DEMO_LEARNER_OPEN_ID = "aft-demo-learner-60d";
export const DEMO_LEARNER_EMAIL = "demo@accountantsfortomorrow.co.za";
export const DEMO_LEARNER_NAME = "AFT Demo Learner";
export function isDemoLearnerOpenId(openId?: string | null): boolean {
  return openId === DEMO_LEARNER_OPEN_ID;
}


/** Shared deployed and overridable browser-smoke destinations. */
export const PUBLISHED_WEBAPP_URL = "https://synle.github.io/bashrc/";
/** Browser target; local smoke configuration supplies its dedicated test server. */
export const WEBAPP_URL = process.env.WEBAPP_URL || PUBLISHED_WEBAPP_URL;

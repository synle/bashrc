/** Shared deployed and overridable browser-integration destinations. */
export const PUBLISHED_WEBAPP_URL = "https://synle.github.io/bashrc/";
/** Browser target; local integration configuration supplies its dedicated test server. */
export const WEBAPP_URL = process.env.WEBAPP_URL || PUBLISHED_WEBAPP_URL;

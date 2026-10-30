// The ede. iPhone app (SPEC decision 80) adds this to its browser's user agent,
// so the site can show app-only screens, such as the welcome screen in place
// of the marketing front page.
export const APP_USER_AGENT = "ede-app";

export const isApp = (userAgent: string | null | undefined) => !!userAgent?.split(" ").includes(APP_USER_AGENT);

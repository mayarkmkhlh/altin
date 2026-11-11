export const uiLanguages = ["en", "ar"] as const;

export type Language = (typeof uiLanguages)[number];

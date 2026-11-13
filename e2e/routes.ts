// Every page a member can open. The audit visits each at 1280 px and at 375 px wide.
export type Route = { name: string; path: string };

export const routes: Route[] = [{ name: "desk", path: "/" }];

export const extraButtonVerbs: string[] = [];

import type { Project } from "../project/config.ts";

/** Steps `tatara new` runs after writing files ("files") and after installing ("installed"). */
export async function afterCreate(_project: Project, _stage: "files" | "installed"): Promise<void> {}

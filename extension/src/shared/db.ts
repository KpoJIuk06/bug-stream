// Shared code — src/core/db.ts. The extension's database is called "adtask" (as before).
import { setDatabaseName } from "../core/db";

setDatabaseName("adtask");
export * from "../core/db";

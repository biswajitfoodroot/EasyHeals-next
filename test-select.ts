import { db } from "./src/db/client";
import { ingestionSources } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function test() {
    try {
        const res = await db.select().from(ingestionSources).limit(1);
        console.log("Success:", res);
    } catch (e: any) {
        console.error("ERROR TYPE:", e.constructor.name);
        console.error("ERROR MESSAGE:", e.message);
    }
}

test();

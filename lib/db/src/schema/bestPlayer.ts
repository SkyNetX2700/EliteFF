import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const bestPlayerExclusionsTable = pgTable("best_player_exclusions", {
  id: serial("id").primaryKey(),
  resultId: integer("result_id").notNull().unique(),
  removedBy: integer("removed_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBestPlayerExclusionSchema = createInsertSchema(bestPlayerExclusionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBestPlayerExclusion = z.infer<typeof insertBestPlayerExclusionSchema>;
export type BestPlayerExclusion = typeof bestPlayerExclusionsTable.$inferSelect;
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";
import { registrationsTable } from "./registrations";

export const matchResultsTable = pgTable("match_results", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournamentsTable.id),
  registrationId: integer("registration_id").notNull().references(() => registrationsTable.id),
  matchNumber: integer("match_number").notNull().default(1),
  squadName: text("squad_name").notNull(),
  placement: text("placement"),
  outcome: text("outcome"),
  kills: integer("kills"),
  prize: integer("prize"),
  prizeType: text("prize_type"),
  screenshotUrl: text("screenshot_url"),
  paymentScreenshotUrl: text("payment_screenshot_url"),
  proofOfRewardUrl: text("proof_of_reward_url"),
  utrNumber: text("utr_number"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMatchResultSchema = createInsertSchema(matchResultsTable).omit({ id: true, createdAt: true });
export type InsertMatchResult = z.infer<typeof insertMatchResultSchema>;
export type MatchResult = typeof matchResultsTable.$inferSelect;

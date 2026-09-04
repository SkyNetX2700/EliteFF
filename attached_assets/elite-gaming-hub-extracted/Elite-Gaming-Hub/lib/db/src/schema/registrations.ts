import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tournamentsTable } from "./tournaments";

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournamentsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  squadName: text("squad_name").notNull(),
  playerNames: text("player_names").notNull(),
  paymentScreenshotUrl: text("payment_screenshot_url"),
  utrNumber: text("utr_number").notNull(),
  status: text("status").notNull().default("pending"),
  slotNumber: integer("slot_number"),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({ id: true, createdAt: true, status: true, slotNumber: true, declineReason: true });
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;

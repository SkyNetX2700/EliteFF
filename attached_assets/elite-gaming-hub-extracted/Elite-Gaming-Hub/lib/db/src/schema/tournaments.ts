import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  mode: text("mode").notNull(),
  mapName: text("map_name"),
  teamSize: text("team_size").notNull(),
  entryFee: integer("entry_fee"),
  prizePool: integer("prize_pool"),
  booyahPrize: integer("booyah_prize"),
  secondPrize: integer("second_prize"),
  thirdPrize: integer("third_prize"),
  highestKillPrize: integer("highest_kill_prize"),
  maxSlots: integer("max_slots").notNull(),
  filledSlots: integer("filled_slots").notNull().default(0),
  status: text("status").notNull().default("upcoming"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  rules: text("rules"),
  posterUrl: text("poster_url"),
  upiId: text("upi_id"),
  qrUrl: text("qr_url"),
  roomId: text("room_id"),
  roomPassword: text("room_password"),
  cancelReason: text("cancel_reason"),
  delayInfo: text("delay_info"),
  isPaid: boolean("is_paid").notNull().default(false),
  timerEnabled: boolean("timer_enabled").notNull().default(true),
  hostId: integer("host_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, createdAt: true, filledSlots: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;

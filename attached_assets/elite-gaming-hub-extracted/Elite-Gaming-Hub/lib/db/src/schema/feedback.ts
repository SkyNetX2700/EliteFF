import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  message: text("message").notNull(),
  rating: integer("rating"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contactTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  message: text("message").notNull(),
  via: text("via").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const historyTable = pgTable("history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tournamentId: integer("tournament_id").notNull(),
  tournamentName: text("tournament_name").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scoreboardTable = pgTable("scoreboard", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  registrationId: integer("registration_id").notNull(),
  squadName: text("squad_name").notNull(),
  kills: integer("kills").notNull().default(0),
  rank: integer("rank"),
  points: integer("points").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;

export const insertHistorySchema = createInsertSchema(historyTable).omit({ id: true, createdAt: true });
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;

export const insertScoreboardSchema = createInsertSchema(scoreboardTable).omit({ id: true, updatedAt: true });
export type InsertScoreboard = z.infer<typeof insertScoreboardSchema>;
export type Scoreboard = typeof scoreboardTable.$inferSelect;

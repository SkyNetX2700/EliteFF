import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email"),
  mobile: text("mobile").notNull().unique(),
  passwordHash: text("password_hash").notNull().default("$supabase$"),
  role: text("role").notNull().default("player"),
  loginMethod: text("login_method").notNull().default("supabase"),
  profilePic: text("profile_pic"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Rank progression fields
  points: integer("points").notNull().default(0),
  rank: text("rank").notNull().default("Blaze"),
  prestigeStars: integer("prestige_stars").notNull().default(0),
  totalEarnings: integer("total_earnings").notNull().default(0),
  // Fair play fields
  weeklyFairPlay: integer("weekly_fair_play").notNull().default(0),
  lastFairPlayAt: timestamp("last_fair_play_at"),
  toxicReportCount: integer("toxic_report_count").notNull().default(0),
  // Point shift tracking
  pointShifts: text("point_shifts"),
  apexRewardGiven: boolean("apex_reward_given").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

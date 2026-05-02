import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  club: text("club").notNull().default(""),
  team: text("team").notNull().default(""),
  userTeamName: text("user_team_name").notNull().default(""),
  clubCodeEntered: text("club_code_entered").notNull().default("false"),
  avatarUri: text("avatar_uri"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectUserProfileSchema = createSelectSchema(userProfilesTable);

export const updateUserProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().optional(),
  avatarUri: z.string().nullable().optional(),
  userTeamName: z.string().trim().max(80).optional(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = z.input<typeof insertUserProfileSchema>;

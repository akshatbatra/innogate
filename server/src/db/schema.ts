import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - stores Auth0 user information
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  auth0Sub: text("auth0_sub").notNull().unique(), // Auth0 subject identifier
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Linked researchers table - stores ORCID associations for each user
export const linkedResearchers = pgTable("linked_researchers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orcidId: text("orcid_id").notNull(), // ORCID identifier (e.g., 0000-0001-6187-6610)
  researcherName: text("researcher_name"), // Cached name from OpenAlex
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure a user can't link the same ORCID twice
  uniqueUserOrcid: unique().on(table.userId, table.orcidId),
}));

// Uploaded PDFs table - stores PDF files for research works
export const uploadedPdfs = pgTable("uploaded_pdfs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Original uploader
  workId: text("work_id").notNull(), // OpenAlex work ID (e.g., W2741809807)
  workTitle: text("work_title"), // Title of the research work
  orcidId: text("orcid_id"), // ORCID of the researcher who authored this work
  researcherName: text("researcher_name"), // Name of the researcher
  fileName: text("file_name").notNull(), // Random unique filename stored on disk
  originalName: text("original_name").notNull(), // Original filename from user
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure an owner can only have one PDF per work
  uniqueOwnerWork: unique().on(table.ownerId, table.workId),
}));

// PDF share requests table - stores sharing requests between users
export const pdfShareRequests = pgTable("pdf_share_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  pdfId: uuid("pdf_id").notNull().references(() => uploadedPdfs.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who shared
  toUserId: uuid("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User receiving the share
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure no duplicate share requests
  uniquePdfToUser: unique().on(table.pdfId, table.toUserId),
}));

// PDF access table - stores who has access to which PDFs (after accepting)
export const pdfAccess = pgTable("pdf_access", {
  id: uuid("id").defaultRandom().primaryKey(),
  pdfId: uuid("pdf_id").notNull().references(() => uploadedPdfs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure no duplicate access entries
  uniquePdfUser: unique().on(table.pdfId, table.userId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  linkedResearchers: many(linkedResearchers),
  uploadedPdfs: many(uploadedPdfs),
  pdfShareRequestsSent: many(pdfShareRequests, { relationName: "sentRequests" }),
  pdfShareRequestsReceived: many(pdfShareRequests, { relationName: "receivedRequests" }),
  pdfAccess: many(pdfAccess),
}));

export const uploadedPdfsRelations = relations(uploadedPdfs, ({ one, many }) => ({
  owner: one(users, {
    fields: [uploadedPdfs.ownerId],
    references: [users.id],
  }),
  shareRequests: many(pdfShareRequests),
  access: many(pdfAccess),
}));

export const pdfShareRequestsRelations = relations(pdfShareRequests, ({ one }) => ({
  pdf: one(uploadedPdfs, {
    fields: [pdfShareRequests.pdfId],
    references: [uploadedPdfs.id],
  }),
  fromUser: one(users, {
    fields: [pdfShareRequests.fromUserId],
    references: [users.id],
    relationName: "sentRequests",
  }),
  toUser: one(users, {
    fields: [pdfShareRequests.toUserId],
    references: [users.id],
    relationName: "receivedRequests",
  }),
}));

export const pdfAccessRelations = relations(pdfAccess, ({ one }) => ({
  pdf: one(uploadedPdfs, {
    fields: [pdfAccess.pdfId],
    references: [uploadedPdfs.id],
  }),
  user: one(users, {
    fields: [pdfAccess.userId],
    references: [users.id],
  }),
}));

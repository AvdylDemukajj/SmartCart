import { pgTable, text, timestamp, uuid, integer, decimal, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== HOUSEHOLDS ====================
export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('EUR'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idx_households_created_at: index('idx_households_created_at').on(table.created_at),
}));

// ==================== USERS ====================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerk_user_id: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  idx_users_clerk_id: index('idx_users_clerk_id').on(table.clerk_user_id),
  idx_users_email: index('idx_users_email').on(table.email),
}));

// ==================== HOUSEHOLD MEMBERS ====================
export const householdMembers = pgTable('household_members', {
  household_id: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
  joined_at: timestamp('joined_at').notNull().defaultNow(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
}, (table) => ({
  pk_household_members: index('pk_household_members').on(table.household_id, table.user_id),
  idx_household_members_user: index('idx_household_members_user').on(table.user_id),
}));

// ==================== GROCERY LISTS ====================
export const groceryLists = pgTable('grocery_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  household_id: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  is_archived: boolean('is_archived').notNull().default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idx_grocery_lists_household: index('idx_grocery_lists_household').on(table.household_id),
  idx_grocery_lists_archived: index('idx_grocery_lists_archived').on(table.is_archived),
}));

// ==================== GROCERY ITEMS ====================
export const groceryItems = pgTable('grocery_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  list_id: uuid('list_id').notNull().references(() => groceryLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category'),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unit: text('unit'),
  is_purchased: boolean('is_purchased').notNull().default(false),
  purchased_by: uuid('purchased_by').references(() => users.id),
  added_by: uuid('added_by').notNull().references(() => users.id),
  purchased_at: timestamp('purchased_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idx_grocery_items_list: index('idx_grocery_items_list').on(table.list_id),
  idx_grocery_items_purchased: index('idx_grocery_items_purchased').on(table.is_purchased),
  idx_grocery_items_category: index('idx_grocery_items_category').on(table.category),
}));

// ==================== ACTIVITY LOGS ====================
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  household_id: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id),
  action_type: text('action_type').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id'),
  metadata: text('metadata'), // JSON string
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  idx_activity_logs_household: index('idx_activity_logs_household').on(table.household_id),
  idx_activity_logs_user: index('idx_activity_logs_user').on(table.user_id),
  idx_activity_logs_created: index('idx_activity_logs_created').on(table.created_at),
}));

// ==================== RECEIPTS ====================
export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  household_id: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  store_name: text('store_name'),
  total_amount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('EUR'),
  purchase_date: timestamp('purchase_date').notNull(),
  image_url: text('image_url'),
  ocr_data: text('ocr_data'), // JSON string
  status: text('status', { enum: ['pending', 'processed', 'needs_review', 'failed'] }).notNull().default('pending'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  idx_receipts_household: index('idx_receipts_household').on(table.household_id),
  idx_receipts_purchase_date: index('idx_receipts_purchase_date').on(table.purchase_date),
}));

// ==================== RECEIPT ITEMS ====================
export const receiptItems = pgTable('receipt_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  receipt_id: uuid('receipt_id').notNull().references(() => receipts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category'),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unit_price: decimal('unit_price', { precision: 10, scale: 2 }),
  total_price: decimal('total_price', { precision: 10, scale: 2 }),
}, (table) => ({
  idx_receipt_items_receipt: index('idx_receipt_items_receipt').on(table.receipt_id),
}));

// ==================== PRICES ====================
export const prices = pgTable('prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  store_id: uuid('store_id').notNull(),
  product_name: text('product_name').notNull(),
  unit_price: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('EUR'),
  valid_from: timestamp('valid_from').notNull(),
  valid_to: timestamp('valid_to'),
  flyer_url: text('flyer_url'),
  scraped_at: timestamp('scraped_at').notNull().defaultNow(),
}, (table) => ({
  idx_prices_store: index('idx_prices_store').on(table.store_id),
  idx_prices_product: index('idx_prices_product').on(table.product_name),
  idx_prices_valid: index('idx_prices_valid').on(table.valid_from, table.valid_to),
}));

// ==================== PRICES STAGING ====================
export const pricesStaging = pgTable('prices_staging', {
  id: uuid('id').primaryKey().defaultRandom(),
  store_id: uuid('store_id').notNull(),
  product_name: text('product_name').notNull(),
  unit_price: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('EUR'),
  valid_from: timestamp('valid_from').notNull(),
  valid_to: timestamp('valid_to'),
  flyer_url: text('flyer_url'),
  scraped_at: timestamp('scraped_at').notNull().defaultNow(),
  validation_status: text('validation_status', { enum: ['pending', 'validated', 'rejected'] }).notNull().default('pending'),
  validation_error: text('validation_error'),
}, (table) => ({
  idx_prices_staging_store: index('idx_prices_staging_store').on(table.store_id),
  idx_prices_staging_status: index('idx_prices_staging_status').on(table.validation_status),
}));

// ==================== BUDGETS ====================
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  household_id: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  total_budget: decimal('total_budget', { precision: 10, scale: 2 }).notNull(),
  spent: decimal('spent', { precision: 10, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('EUR'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idx_budgets_household: index('idx_budgets_household').on(table.household_id),
  idx_budgets_month_year: index('idx_budgets_month_year').on(table.month, table.year, table.household_id),
}));

// ==================== AI REQUESTS ====================
export const aiRequests = pgTable('ai_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  request_type: text('request_type').notNull(),
  prompt: text('prompt').notNull(),
  response: text('response'), // JSON string
  tokens_used: integer('tokens_used'),
  cost: decimal('cost', { precision: 10, scale: 6 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  idx_ai_requests_user: index('idx_ai_requests_user').on(table.user_id),
  idx_ai_requests_type: index('idx_ai_requests_type').on(table.request_type),
  idx_ai_requests_created: index('idx_ai_requests_created').on(table.created_at),
}));

// ==================== STORES ====================
export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  region: text('region').notNull(), // 'KOS', 'AL', 'DE'
  logo_url: text('logo_url'),
  website_url: text('website_url'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// ==================== RELATIONS ====================
export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  lists: many(groceryLists),
  receipts: many(receipts),
  budgets: many(budgets),
  activityLogs: many(activityLogs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(householdMembers),
  addedItems: many(groceryItems, { relationName: 'addedBy' }),
  purchasedItems: many(groceryItems, { relationName: 'purchasedBy' }),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.household_id],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdMembers.user_id],
    references: [users.id],
  }),
}));

export const groceryListsRelations = relations(groceryLists, ({ one, many }) => ({
  household: one(households, {
    fields: [groceryLists.household_id],
    references: [households.id],
  }),
  items: many(groceryItems),
}));

export const groceryItemsRelations = relations(groceryItems, ({ one }) => ({
  list: one(groceryLists, {
    fields: [groceryItems.list_id],
    references: [groceryLists.id],
  }),
  addedBy: one(users, {
    fields: [groceryItems.added_by],
    references: [users.id],
    relationName: 'addedBy',
  }),
  purchasedBy: one(users, {
    fields: [groceryItems.purchased_by],
    references: [users.id],
    relationName: 'purchasedBy',
  }),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  household: one(households, {
    fields: [receipts.household_id],
    references: [households.id],
  }),
  items: many(receiptItems),
}));

export const receiptItemsRelations = relations(receiptItems, ({ one }) => ({
  receipt: one(receipts, {
    fields: [receiptItems.receipt_id],
    references: [receipts.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  household: one(households, {
    fields: [budgets.household_id],
    references: [households.id],
  }),
}));

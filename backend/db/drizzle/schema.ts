import { boolean, date, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const households = pgTable('households', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const householdMembers = pgTable('household_members', {
  householdId: uuid('household_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const listItems = pgTable('list_items', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id').notNull(),
  name: text('name').notNull(),
  quantity: numeric('quantity').notNull(),
  category: text('category').notNull(),
  purchased: boolean('purchased').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const monthlyBudgets = pgTable('monthly_budgets', {
  householdId: uuid('household_id').primaryKey(),
  month: text('month').notNull(),
  budgetLimit: numeric('budget_limit').notNull(),
  spent: numeric('spent').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id').notNull(),
  store: text('store').notNull(),
  total: numeric('total').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const receiptItems = pgTable('receipt_items', {
  id: uuid('id').primaryKey(),
  receiptId: uuid('receipt_id').notNull(),
  name: text('name').notNull(),
  quantity: numeric('quantity').notNull(),
  unitPrice: numeric('unit_price').notNull(),
  total: numeric('total').notNull(),
});

export const pantryItems = pgTable('pantry_items', {
  id: uuid('id').primaryKey(),
  householdId: uuid('household_id').notNull(),
  name: text('name').notNull(),
  quantity: numeric('quantity').notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull(),
});

export const storePricesLive = pgTable('store_prices_live', {
  id: uuid('id').primaryKey(),
  store: text('store').notNull(),
  itemKey: text('item_key').notNull(),
  unitPrice: numeric('unit_price').notNull(),
  source: text('source'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
});

export const flyerOffers = pgTable('flyer_offers', {
  id: uuid('id').primaryKey(),
  store: text('store').notNull(),
  keyword: text('keyword').notNull(),
  discountPercent: integer('discount_percent').notNull(),
  label: text('label').notNull(),
  validFrom: date('valid_from'),
  validTo: date('valid_to'),
});

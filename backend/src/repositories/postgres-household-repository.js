import { Pool } from 'pg';

export class PostgresHouseholdRepository {
  constructor({ connectionString, schema = null }) {
    this.pool = new Pool({ connectionString });
    if (schema) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error('INVALID_SCHEMA_NAME');
      this.pool.on('connect', (client) => {
        void client.query(`set search_path to ${schema},public`);
      });
    }
  }

  async close() {
    await this.pool.end();
  }

  async createHousehold({ id, name, ownerId, createdAt, month, defaultBudgetLimit = 300 }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `insert into households (id, name, owner_id, created_at)
         values ($1, $2, $3, $4)`,
        [id, name, ownerId, createdAt],
      );
      await client.query(
        `insert into household_members (household_id, user_id, role)
         values ($1, $2, 'owner')`,
        [id, ownerId],
      );
      await client.query(
        `insert into monthly_budgets (household_id, month, budget_limit, spent, updated_at)
         values ($1, $2, $3, 0, $4)`,
        [id, month, defaultBudgetLimit, createdAt],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listUserHouseholds(userId) {
    const result = await this.pool.query(
      `select h.id, h.name, h.owner_id as "ownerId", h.created_at as "createdAt"
       from households h
       join household_members hm on hm.household_id = h.id
       where hm.user_id = $1
       order by h.created_at asc`,
      [userId],
    );
    return result.rows;
  }

  async addMember({ householdId, memberId }) {
    await this.pool.query(
      `insert into household_members (household_id, user_id, role)
       values ($1, $2, 'member')
       on conflict (household_id, user_id) do nothing`,
      [householdId, memberId],
    );
    return { householdId, memberId };
  }

  async assertMember({ householdId, userId }) {
    const result = await this.pool.query(
      `select 1
       from household_members
       where household_id = $1 and user_id = $2`,
      [householdId, userId],
    );
    return result.rowCount > 0;
  }

  async addItem({ id, householdId, name, quantity, category, purchased, createdAt, updatedAt }) {
    await this.pool.query(
      `insert into list_items (id, household_id, name, quantity, category, purchased, version, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, 1, $7, $8)`,
      [id, householdId, name, quantity, category, purchased, createdAt, updatedAt],
    );
  }

  async listItems({ householdId }) {
    const result = await this.pool.query(
      `select id, name, quantity, category, purchased, version, created_at as "createdAt", updated_at as "updatedAt"
       from list_items
       where household_id = $1
       order by created_at asc`,
      [householdId],
    );
    return result.rows;
  }

  async toggleItem({ householdId, itemId, expectedVersion }) {
    const existing = await this.pool.query(
      `select id, purchased, version
       from list_items
       where household_id = $1 and id = $2`,
      [householdId, itemId],
    );
    if (existing.rowCount === 0) return null;
    const row = existing.rows[0];
    if (expectedVersion !== undefined && Number(row.version) !== expectedVersion) return { conflict: true };

    const updated = await this.pool.query(
      `update list_items
       set purchased = not purchased,
           version = version + 1,
           updated_at = now()
       where household_id = $1 and id = $2
       returning id, name, quantity, category, purchased, version, created_at as "createdAt", updated_at as "updatedAt"`,
      [householdId, itemId],
    );
    return updated.rows[0];
  }

  async getBudget({ householdId }) {
    const result = await this.pool.query(
      `select household_id as "householdId", month, budget_limit as "limit", spent, updated_at as "updatedAt"
       from monthly_budgets
       where household_id = $1`,
      [householdId],
    );
    return result.rows[0] ?? null;
  }

  async setBudgetLimit({ householdId, limit }) {
    const result = await this.pool.query(
      `update monthly_budgets
       set budget_limit = $2,
           updated_at = now()
       where household_id = $1
       returning household_id as "householdId", month, budget_limit as "limit", spent, updated_at as "updatedAt"`,
      [householdId, limit],
    );
    return result.rows[0] ?? null;
  }

  async addPantryItem({ id, householdId, name, quantity, addedAt }) {
    const result = await this.pool.query(
      `insert into pantry_items (id, household_id, name, quantity, added_at)
       values ($1, $2, $3, $4, $5)
       returning id, name, quantity, added_at as "addedAt"`,
      [id, householdId, name, quantity, addedAt],
    );
    return result.rows[0];
  }

  async listPantry({ householdId }) {
    const result = await this.pool.query(
      `select id, name, quantity, added_at as "addedAt"
       from pantry_items
       where household_id = $1
       order by added_at asc`,
      [householdId],
    );
    return result.rows;
  }

  async addReceipt({ householdId, receiptId, store, total, createdAt, items, budgetSpent }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `insert into receipts (id, household_id, store, total, created_at)
         values ($1, $2, $3, $4, $5)`,
        [receiptId, householdId, store, total, createdAt],
      );
      for (const item of items) {
        await client.query(
          `insert into receipt_items (id, receipt_id, name, quantity, unit_price, total)
           values ($1, $2, $3, $4, $5, $6)`,
          [item.id, receiptId, item.name, item.quantity, item.unitPrice, item.total],
        );
      }
      await client.query(
        `update monthly_budgets
         set spent = $2,
             updated_at = now()
         where household_id = $1`,
        [householdId, budgetSpent],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listReceipts({ householdId }) {
    const receiptsResult = await this.pool.query(
      `select id, store, total, created_at as "createdAt"
       from receipts
       where household_id = $1
       order by created_at desc`,
      [householdId],
    );

    const rows = [];
    for (const receipt of receiptsResult.rows) {
      const itemsResult = await this.pool.query(
        `select name, quantity, unit_price as "unitPrice", total
         from receipt_items
         where receipt_id = $1`,
        [receipt.id],
      );
      rows.push({
        ...receipt,
        items: itemsResult.rows,
      });
    }
    return rows;
  }

  async addActivity({ id, householdId, actorId, type, message, createdAt }) {
    const result = await this.pool.query(
      `insert into activity_log (id, household_id, actor_id, type, message, created_at)
       values ($1, $2, $3, $4, $5, $6)
       returning id, household_id as "householdId", actor_id as "actorId", type, message, created_at as "createdAt"`,
      [id, householdId, actorId, type, message, createdAt],
    );
    return result.rows[0];
  }

  async listActivity({ householdId }) {
    const result = await this.pool.query(
      `select id, household_id as "householdId", actor_id as "actorId", type, message, created_at as "createdAt"
       from activity_log
       where household_id = $1
       order by created_at asc`,
      [householdId],
    );
    return result.rows;
  }


  async appendSecurityAuditLog(entry) {
    await this.pool.query(
      `insert into security_audit_log (
        id,
        event,
        request_id,
        user_id,
        path,
        reason,
        created_at,
        prev_hash,
        hash
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.id,
        entry.event,
        entry.requestId ?? null,
        entry.userId ?? null,
        entry.path ?? null,
        entry.reason ?? null,
        entry.createdAt,
        entry.prevHash,
        entry.hash,
      ],
    );
  }

  async listSecurityAuditLog({ limit = 100, ascending = false } = {}) {
    const boundedLimit = Math.max(1, Math.min(5000, Number(limit) || 100));
    const order = ascending ? 'asc' : 'desc';
    const result = await this.pool.query(
      `select
         id,
         event,
         request_id as "requestId",
         user_id as "userId",
         path,
         reason,
         created_at as "createdAt",
         prev_hash as "prevHash",
         hash
       from security_audit_log
       order by created_at ${order}, id ${order}
       limit $1`,
      [boundedLimit],
    );
    return ascending ? result.rows : [...result.rows].reverse();
  }

  async pruneSecurityAuditLog({ cutoffIso, maxEntries = 500 }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const older = await client.query(
        `delete from security_audit_log where created_at < $1`,
        [cutoffIso],
      );

      const overflow = await client.query(
        `delete from security_audit_log
         where id in (
           select id from security_audit_log
           order by created_at desc, id desc
           offset $1
         )`,
        [maxEntries],
      );

      await client.query('COMMIT');
      return { deleted: older.rowCount + overflow.rowCount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

}
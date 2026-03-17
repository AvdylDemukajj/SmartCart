export class InMemoryAppRepository {
  constructor() {
    this.households = new Map();
    this.memberships = new Map();
    this.listItems = new Map();
    this.activity = new Map();
    this.budgets = new Map();
    this.receipts = new Map();
    this.pantry = new Map();
    this.recipeUsage = new Map();
    this.receiptUploads = new Map();
    this.receiptOcrJobs = new Map();
    this.securityAuditLog = [];
    this.dbTraces = new Map();
  }

  recordDbTrace({ requestId, operation, entity, householdId = null, meta = {} }) {
    if (!requestId) return;
    const traces = this.dbTraces.get(requestId) ?? [];
    traces.push({
      operation,
      entity,
      householdId,
      meta,
      at: new Date().toISOString(),
    });
    this.dbTraces.set(requestId, traces);
  }

  getDbTrace(requestId) {
    return this.dbTraces.get(requestId) ?? [];
  }
}

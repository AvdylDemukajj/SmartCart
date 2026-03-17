# Drizzle Scaffold

Ky folder përmban bazën për migrim gradual nga in-memory state te Postgres + Drizzle ORM:

- `schema.ts`: definimet e tabelave kryesore për domain-in SmartCart.
- `../migrations/0001_initial.sql`: migrimi fillestar SQL.

> Në këtë fazë, runtime i backend-it vazhdon të përdorë in-memory implementation.
> Hapi i ardhshëm është lidhja e repository layer-it me Drizzle queries.

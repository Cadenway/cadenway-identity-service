---
paths:
  - 'src/modules/**/infrastructure/**'
---

# Infrastructure layer

- Repositories implement the ports declared by the application layer; they map rows to domain
  objects and back, nothing more.
- Use the ORM already declared in package.json; never add a second one.
- Queries are tenant-scoped (`organization_id`), paginated and backed by an index.
- External clients (payment, email, Git providers, storage) sit behind a port with a fake for tests.
- This service reads and writes **only its own database**.

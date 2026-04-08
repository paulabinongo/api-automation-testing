# Loan API automation

Full setup, test commands, and the loan lifecycle walkthrough are in **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)**.

**Contract:** **`javascript/mock-server/openapi.json`** drives **Swagger UI** (`npm run start:mock` → `/docs`) and **`/openapi.json`**. It documents all routes, including the conditional **`POST /v1/loan-applications/{applicationId}/compliance/pep-clearance`** (PEP **Yes** before **submit**), in sync with **`docs/DOCUMENTATION.md`**.

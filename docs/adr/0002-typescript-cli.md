# The CLI is TypeScript with zod, run directly by Node

The deterministic CLI is TypeScript. Node 22.18+ runs `.ts` files directly (type stripping), so there is no build step. One `zod` schema gives the types, the file validation and the error messages for the bible, plan, threads and ledger. Python with pydantic was about equally good. TypeScript won because the user's other tools already use it.

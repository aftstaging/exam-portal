# Accountants for Tomorrow LMS — Node.js Architecture

## Runtime

The portal is a Node.js application using an ESM/TypeScript server entry point at `server/_core/index.ts`. The Express application creates the HTTP server, registers the webhook and storage routes, mounts the OAuth routes, exposes the typed API, and serves the Vite development experience or compiled static output depending on `NODE_ENV`. The application reads the managed runtime port from `process.env.PORT` and never relies on a hard-coded deployment port.

## API boundary

The application uses tRPC 11 under `/api/trpc`. Procedures are defined in `server/routers.ts`, validated with Zod, and executed through the request context created in `server/_core/context.ts`. Public procedures expose catalogue data and auth state. Protected procedures require a signed local session and use `ctx.user`; administrator procedures additionally check `ctx.user.role === "admin"` before allowing product, marking, or content operations.

## Data layer

Drizzle ORM connects the Node.js server to the managed MySQL/TiDB database. The schema in `drizzle/schema.ts` models users, qualifications and levels, products, entitlements, resources, mock exams, case-study sections, attempts, answers, submissions, objective questions, marking, feedback states, notifications, and audit events. File bytes are intended for S3-backed storage; database rows retain metadata and protected storage references.

## Exam integrity

Exam submissions are server-validated against the authenticated attempt owner and current attempt status. Once an attempt is submitted, the server writes an immutable submission record and changes the attempt status so subsequent writes are rejected. Answer saves are checked against attempt ownership and editability. The client presents remaining time and autosave state, while the server remains the authority for submission and lock state.

## Stripe integration

The Stripe webhook is registered before `express.json()` in `server/_core/index.ts`, ensuring that the raw request body remains available for signature verification at `/api/stripe/webhook`. Checkout sessions are created by the authenticated `payments.createCheckout` procedure with `client_reference_id` and metadata containing the user and product identifiers. The verified `checkout.session.completed` event grants an entitlement and creates a purchase notification. Sensitive card data and raw webhook payloads are not stored.

## Frontend

The React frontend is routed with Wouter and uses the Accountants for Tomorrow visual system: deep navy authority surfaces, vivid green actions, pale mint exam surfaces, readable sans-serif typography, and no chat, Teams, or support-widget overlays. The public experience, student dashboard, case-study exam shell, objective-test foundation, and admin console are currently presented through `client/src/pages/Home.tsx`; the server procedures provide the typed path for replacing preview data with live records as the remaining product work is completed.

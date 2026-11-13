# Elite Private Spa — Version 3

## Features
- Customer booking form
- Admin login and booking dashboard
- Confirm / reject bookings
- Admin assigns a separate payment number, account name, and instructions to each booking
- Admin saves the details and generates a unique private payment link for that booking
- Customer's private page shows only that booking's payment details
- Admin can mark payment as Paid manually

## Run locally (Windows)
1. Install Node.js LTS from https://nodejs.org/
2. Extract this ZIP.
3. Copy `.env.example` to `.env`.
4. Edit `.env` and set a strong `ADMIN_PASSWORD` and `SESSION_SECRET`.
5. Open Command Prompt in this folder and run:
   `npm install`
   `npm start`
6. Open http://localhost:3000 for customers.
7. Open http://localhost:3000/admin.html for the admin panel.

Default username is `admin`. Set your own password in `.env`; the placeholder password is intentionally rejected.

## Deploying
This is a Node.js app and needs a Node-compatible host. Set environment variables on the host:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `BASE_URL` (your public https URL)
- `DB_PATH` (a persistent disk path, if the host requires one)

**Important:** Use a host with persistent disk/database storage for SQLite. Do not deploy this SQLite app on an ephemeral filesystem or customer bookings may be lost. Add HTTPS, backups, and a production session store before accepting real customer data.

## Important payment note
This version supports manual payment instructions per booking. It does not process or automatically verify card/mobile-wallet payments. The admin must verify receipt and mark a booking as Paid.

# HealthHub - An Integrated Online Healthcare Management System

A semester project built with **plain HTML / CSS / JavaScript**, **Node.js + Express** and **MySQL**, organised with the **MVC** pattern (Model - View - Controller).

Features: register / login (5 roles), hospital search, ICU & CCU search, hospital recommendation, doctor profiles, appointment booking / reschedule / cancel, online payment (simulated gateway), health record upload, emergency contacts, ambulance search, blood bank search, vaccine & anti-venom search.

> **For the teacher:** follow Steps 1-7 below. It takes about 5 minutes. Every command can be copy-pasted.

---

## What you need first

| Software | Version | Check with | Download |
|---|---|---|---|
| Node.js (includes npm) | 18 or newer (we used 20/22) | `node -v` and `npm -v` | https://nodejs.org (choose LTS) |
| MySQL Server | 8.0 (MariaDB 10.x also works) | `mysql --version` | https://dev.mysql.com/downloads/mysql/ |
| Git | any | `git --version` | https://git-scm.com |

MySQL must be **running** (Windows: Services -> MySQL80 -> Running; or start XAMPP/WAMP MySQL; Mac: `brew services start mysql`).

---

## Step 1 - Clone the repository

```bash
git clone https://github.com/<team-username>/healthhub.git
cd healthhub
```

## Step 2 - Install the dependencies

```bash
npm install
```

(This reads `package.json` and creates the `node_modules` folder. It needs internet.)

## Step 3 - Create the settings file `.env`

Copy the template:

```bash
# Windows (Command Prompt or PowerShell)
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Open `.env` in any text editor and **type your own MySQL password**:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here      <-- change this (leave empty if root has no password)
DB_NAME=healthhub
SESSION_SECRET=any_long_random_text_here
```

## Step 4 - Create the database and demo data (automatic)

```bash
npm run db:setup
```

You should see:

```
Database "healthhub" created.
Ran 01-users.sql
Ran 02-hospitals.sql
...
Ran 08-vaccines.sql
Done. Demo password for all users: Password123
```

This creates the database, all tables and the demo data (users, hospitals, doctors, time slots for the next 3 days, blood banks, vaccines, ambulances...). You can run it again at any time to reset everything.

*Prefer MySQL Workbench / phpMyAdmin instead?* Create a database named `healthhub`, then import the files in the `database` folder **one by one in number order** (`01-users.sql` first, `08-vaccines.sql` last).

## Step 5 - Start the server

```bash
npm start
```

You should see: `HealthHub is running at http://localhost:3000`. Keep this window open. (Stop with `Ctrl + C`.)

## Step 6 - Open the pages in the browser

| Page | Address |
|---|---|
| Home | http://localhost:3000/ |
| Register | http://localhost:3000/register.html |
| Login | http://localhost:3000/login.html |
| Dashboard (after login) | http://localhost:3000/dashboard.html |
| Hospital search | http://localhost:3000/hospital-search.html |
| ICU / CCU search | http://localhost:3000/icu-search.html |
| Hospital recommendation | http://localhost:3000/recommendation.html |
| Doctors + booking | http://localhost:3000/doctors.html |
| My appointments / doctor schedule | http://localhost:3000/appointments.html |
| Payment | http://localhost:3000/payment.html |
| Health records | http://localhost:3000/health-records.html |
| Emergency contacts | http://localhost:3000/emergency.html |
| Ambulance search | http://localhost:3000/ambulance.html |
| Blood bank search | http://localhost:3000/blood-bank.html |
| Vaccine & anti-venom search | http://localhost:3000/vaccine.html |

### Demo accounts (password for all: `Password123`)

| Role | Email | What to try |
|---|---|---|
| Patient | `patient@healthhub.com` | Book an appointment, pay, upload a record |
| Doctor | `doctor@healthhub.com` | Appointments page shows the doctor's schedule |
| Hospital authority | `hospital@healthhub.com` | Emergency page: add / edit / delete contacts |
| Ambulance provider | `ambulance@healthhub.com` | Ambulance page: mark available / busy |
| Administrator | `admin@healthhub.com` | Same staff rights as above |

### Payment test numbers (the payment gateway is simulated)

- Card number ending **0002** -> "Payment Failed. Please try again."
- Card number ending **9999** -> Pending
- Any other 16 digits (for example `4242 4242 4242 4242`) -> Successful
- For mobile banking / wallet use an 11 digit number like `01712345678`.

## Step 7 - Run the automated tests (optional)

Run `npm run db:setup` first (the integration tests use the demo data), then:

```bash
npm run test:unit          # 32 unit tests (plain functions, no database)
npm run test:integration   # 78 integration tests (API + real MySQL)
npm test                   # all 110 tests
```

Tests are written with **Vitest** and **Supertest**. GitHub Actions runs the same tests on every push (`.github/workflows/test.yml`).

## Code documentation (JSDoc)

```bash
npm run docs
```

Then open `docs/jsdoc/index.html` in a browser.

---

## Project structure (MVC)

```
app.js, server.js        start-up and route mounting
config/db.js             MySQL connection pool
models/                  MODEL      - SQL queries only
controllers/             CONTROLLER - checks input, calls models, sends JSON
routes/                  ROUTE      - URL -> controller function
views/  public/          VIEW       - HTML pages, CSS, browser JavaScript (fetch)
middleware/  utils/      login/role checks, file upload, small validators
database/                SQL files (tables + demo data)
tests/                   unit/ and integration/
docs/                    team guide + one viva guide per member
```

## Team and modules

| Member | Module |
|---|---|
| 1 | Authentication (registration, login, dashboard) |
| 2 | Hospital search, ICU/CCU search, hospital recommendation |
| 3 | Doctor profile, appointment booking |
| 4 | Online payment, health record upload |
| 5 | Emergency contacts, ambulance search |
| 6 | Blood bank search, vaccine & anti-venom search |

(Replace this table with the real names before submission.) Details: `docs/TEAM-GUIDE.md` and `docs/viva/member-N.md`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ER_ACCESS_DENIED_ERROR` / "Access denied for user" | The password in `.env` is wrong. Fix `DB_PASSWORD` and run the command again. |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running. Start the MySQL service, then try again. |
| `Client does not support authentication protocol` | Very old MySQL client settings. Use MySQL 8 with this project's `mysql2` (already installed), or create the user with `mysql_native_password`. |
| `EADDRINUSE: address already in use :::3000` | Another program uses port 3000. Change `PORT=3001` in `.env` and open `http://localhost:3001`. |
| Pages open but lists are empty / error | Run `npm run db:setup` again (the database may not be created). |
| Integration tests fail | Run `npm run db:setup` first, make sure MySQL is running, and that the server is not required (tests start their own app). |
| `'npm' is not recognized` | Install Node.js and reopen the terminal. |
| Booking slots look old | Demo slots are made for "today + 1/2/3 days" when `db:setup` runs. Run `npm run db:setup` again to refresh them. |

# HealthHub Team Guide (for the 6 team members)

This guide covers: **Section 1** architecture and the safe Git workflow, **Section 2** who owns what, **Section 3** testing. The code and the viva script of each member are in `docs/viva/member-1.md` ... `member-6.md`. The teacher's setup steps are in the root `README.md`.

---

## 0. Decisions we made (know these for the viva)

| Topic | What the wiki / request said | What we did | Why |
|---|---|---|---|
| Database layer | Wiki "Architectural Pattern" table says *Sequelize*. The project brief says plain `mysql2`. | Plain `mysql2` with raw, parameterized SQL (`pool.execute( sql, [ values ] )`). | Beginners can explain every query. **Fix the wiki table**: Model = "plain `mysql2` files with SQL queries". |
| Test tool | Testing wiki: **Vitest** + GitHub Actions. Brief says "Jest and Supertest". | **Vitest + Supertest.** | The team's own wiki chose Vitest. Vitest uses the same `describe / it / expect` words as Jest, so everything in this guide also applies to Jest. |
| File names | Coding standard: lowercase kebab-case. | `user-model.js`, `auth-controller.js`, `hospital-routes.js` ... | Follows the project's JavaScript Coding Standard. |
| Code style | Coding standard. | Tabs, single quotes, semicolons, `===`, spaces inside `( )`, `const`/`let`, `UPPER_SNAKE_CASE` constants, JSDoc on every function. | Required before merging into `main`. |
| Language | Wiki shows `import`. | Node.js CommonJS (`require` / `module.exports`) in the app, `import` in tests. | `require` is the most common beginner style with Express and needs no extra setup. |

**Things we simplified on purpose** (say them before the teacher asks):

- Payment gateway is **simulated** (card/phone ending `0002` fails, `9999` pending, others succeed).
- No "Forgot password", no appointment reminders (need an email/scheduler service), no GPS distance, no patient reviews table, no separate page per role (one dashboard page that changes by role).
- Hospital / blood bank / ambulance data is changed only through the database (seed files); only emergency contacts and ambulance availability have edit screens.
- Sessions are kept in server memory (restarting the server logs everyone out). Production would use a session store and HTTPS.

---

# SECTION 1 - Architecture and safe Git workflow

## 1.1 Folder structure (MVC)

```
healthhub/
├── app.js                      Express app: middleware + ALL route mounting (written once on Day 0)
├── server.js                   Starts the server (npm start)
├── package.json                Dependencies and npm scripts
├── .env.example                Template for the secret settings (copy to .env)
├── vitest.config.mjs           Test settings
├── config/
│   └── db.js                   One shared MySQL connection pool
├── middleware/
│   ├── auth-middleware.js      requireLogin, requireRole  (shared, Day 0)
│   └── upload-middleware.js    multer file upload settings (Member 4)
├── utils/
│   └── validators.js           Small shared checks: email, phone, search text, ids (shared, Day 0)
├── models/                     MODEL      - SQL only, no req/res
│   ├── user-model.js                (M1)
│   ├── hospital-model.js            (M2)
│   ├── doctor-model.js, appointment-model.js        (M3)
│   ├── payment-model.js, health-record-model.js     (M4)
│   ├── emergency-model.js, ambulance-model.js       (M5)
│   └── blood-bank-model.js, vaccine-model.js        (M6)
├── controllers/                CONTROLLER - validate input, call the model, send JSON
│   └── (same names with -controller.js)
├── routes/                     ROUTE      - URL -> controller function (+ login/role checks)
│   └── (same names with -routes.js)
├── views/                      VIEW       - HTML pages
│   └── index, register, login, dashboard, hospital-search, icu-search, recommendation,
│       doctors, appointments, payment, health-records, emergency, ambulance, blood-bank, vaccine (.html)
├── public/                     VIEW       - files the browser downloads
│   ├── css/style.css               shared look (Day 0)
│   └── js/common.js                shared helpers (Day 0) + one page script per page
├── database/                   01-users.sql ... 08-vaccines.sql (tables + demo data, run in number order)
├── scripts/setup-db.js         npm run db:setup
├── tests/
│   ├── setup.js, helpers/      shared test helpers (Day 0)
│   ├── unit/                   plain-function tests (no database)
│   └── integration/            Supertest + real database
├── uploads/                    Health record files (not in Git)
├── docs/                       This guide, viva scripts, JSDoc output
└── .github/                    workflows/test.yml (CI) and pull_request_template.md
```

**Request path:** `Browser page (View)` -> `fetch()` -> `app.js` -> `routes/*-routes.js` -> `controllers/*-controller.js` -> `models/*-model.js` -> `MySQL` and back as JSON.

| Layer | Our files | One sentence |
|---|---|---|
| Model | `models/*.js` | Talks to MySQL. Knows tables and SQL. Does not know HTTP. |
| View | `views/*.html`, `public/js/*.js`, `public/css` | What the user sees and clicks. Does not know SQL. |
| Controller | `controllers/*.js` | Receives the request, checks it, uses the Model, chooses the answer. |
| Route | `routes/*.js` | Connects `METHOD + URL` to a controller function. |

## 1.2 How 6 people avoid merge conflicts

Git only creates a conflict when **two branches change the same lines of the same file**. So the whole design is: **nobody edits a file that belongs to someone else.**

1. **Every feature lives in its own files.** Each member has their own model, controller, routes, HTML, page JS and tests (table below).
2. **`app.js` is finished on Day 0.** It already contains `app.use( '/api/hospitals', require( './routes/hospital-routes' ) )` for every member. Nobody edits `app.js` later (this is the "modular route mounting").
3. **Route files exist as empty stubs on Day 0**, so `app.js` never crashes. Each member replaces only their own stub.
4. **The database design is agreed on Day 0.** All `database/0X-*.sql` files are in `main` from the start (numbered so tables are created in the right order). Each file belongs to one member.
5. **Shared files have ONE owner** (the Team Lead = Member 1). Need a change? Ask the lead, who makes a small separate PR.
6. **Commit only your own files:** use `git add path/to/file`. Do not use `git add .` or `git add -A`.
7. **Update often:** merge `main` into your branch every day (1.4). Small and frequent updates mean small, easy merges.
8. **One member = one branch = one pull request** (plus extra small PRs for fixes).

### File ownership table

| Member | Module | Files they create / edit |
|---|---|---|
| **1** (Team Lead) | Authentication + Dashboard | `models/user-model.js`, `controllers/auth-controller.js`, `routes/auth-routes.js`, `views/register.html`, `views/login.html`, `views/dashboard.html`, `public/js/register.js`, `login.js`, `dashboard.js`, `tests/*/auth.test.js` |
| **2** | Hospital Search, ICU/CCU, Recommendation | `models/hospital-model.js`, `controllers/hospital-controller.js`, `routes/hospital-routes.js`, `views/hospital-search.html`, `icu-search.html`, `recommendation.html`, `public/js/hospital-search.js`, `icu-search.js`, `recommendation.js`, `tests/*/hospital.test.js` |
| **3** | Doctor Profile + Appointments | `models/doctor-model.js`, `appointment-model.js`, `controllers/doctor-controller.js`, `appointment-controller.js`, `routes/doctor-routes.js`, `appointment-routes.js`, `views/doctors.html`, `appointments.html`, `public/js/doctors.js`, `appointments.js`, `tests/*/appointment.test.js` |
| **4** | Payment + Health Records | `models/payment-model.js`, `health-record-model.js`, `controllers/payment-controller.js`, `health-record-controller.js`, `middleware/upload-middleware.js`, `routes/payment-routes.js`, `health-record-routes.js`, `views/payment.html`, `health-records.html`, `public/js/payment.js`, `health-records.js`, `tests/unit/payment.test.js`, `tests/integration/payment.test.js`, `health-record.test.js` |
| **5** | Emergency Contacts + Ambulance | `models/emergency-model.js`, `ambulance-model.js`, `controllers/emergency-controller.js`, `ambulance-controller.js`, `routes/emergency-routes.js`, `ambulance-routes.js`, `views/emergency.html`, `ambulance.html`, `public/js/emergency.js`, `ambulance.js`, `tests/*/emergency-ambulance.test.js` |
| **6** (Docs owner) | Blood Bank + Vaccine/Anti-venom | `models/blood-bank-model.js`, `vaccine-model.js`, `controllers/blood-bank-controller.js`, `vaccine-controller.js`, `routes/blood-bank-routes.js`, `vaccine-routes.js`, `views/blood-bank.html`, `vaccine.html`, `public/js/blood-bank.js`, `vaccine.js`, `tests/*/blood-vaccine.test.js` |

### Shared files (Day 0, owner = Member 1; do not edit)

`app.js`, `server.js`, `package.json`, `package-lock.json`, `vitest.config.mjs`, `.env.example`, `.gitignore`, `config/db.js`, `middleware/auth-middleware.js`, `utils/validators.js`, `database/*.sql`, `scripts/setup-db.js`, `public/css/style.css`, `public/js/common.js`, `views/index.html`, `tests/setup.js`, `tests/helpers/*`, `tests/unit/validators.test.js`, `.github/*`, `README.md`, `docs/*`. Member 6 keeps `README.md` and `docs/` up to date (through a PR that only touches those files).

## 1.3 Git step by step

### Day 0 - Team Lead (Member 1) only

```bash
# 1. On github.com: New repository -> name "healthhub" -> Public/Private -> Create (do not add a README).
#    Settings -> Collaborators -> add the 5 other members.

# 2. On your computer, unzip healthhub-skeleton.zip into a folder called healthhub, then:
cd healthhub
git init -b main
git add .
git commit -m "chore: add project skeleton (shared files, route stubs, database, CI)"
git remote add origin https://github.com/<your-username>/healthhub.git
git push -u origin main

# 3. On GitHub: Settings -> Branches -> Add rule for "main":
#    tick "Require a pull request before merging" and "Require approvals: 1".
#    (This makes the PR step real and protects main.)
```

### Day 0 - everybody else (Members 2-6)

```bash
git clone https://github.com/<your-username>/healthhub.git
cd healthhub
npm install
copy .env.example .env          # Windows.  Mac/Linux: cp .env.example .env
# open .env and type your MySQL password
npm run db:setup                # creates the database and demo data
npm start                       # open http://localhost:3000  (Ctrl+C to stop)
```

### Every member - build your feature (replace N and the names)

```bash
# STEP 1  Start from the newest main
git checkout main
git pull origin main

# STEP 2  Create YOUR branch (name = feature/member-N-short-name)
git checkout -b feature/member-2-hospitals

# STEP 3  Create/paste your files (from docs/viva/member-N.md), run the app and the tests
npm start
npm run test:unit
npm run test:integration

# STEP 4  See what changed. Only YOUR files should appear!
git status

# STEP 5  Add your files by name (not "git add .")
git add models/hospital-model.js controllers/hospital-controller.js routes/hospital-routes.js
git add views/hospital-search.html views/icu-search.html views/recommendation.html
git add public/js/hospital-search.js public/js/icu-search.js public/js/recommendation.js
git add tests/unit/hospital.test.js tests/integration/hospital.test.js

# STEP 6  Commit with a clear message (small commits are good: commit after each file group)
git commit -m "feat(hospitals): add hospital search, ICU/CCU search and recommendation"

# STEP 7  Push your branch to GitHub (first time uses -u)
git push -u origin feature/member-2-hospitals
```

Commit message format: `type(module): short sentence`. Types: `feat` (new feature), `fix` (bug), `test` (tests), `docs` (documents), `chore` (setup). Example: `fix(appointments): free the slot when booking fails`.

### Keep your branch updated (do this every day, and before every PR)

```bash
git checkout main
git pull origin main              # get what others merged
git checkout feature/member-2-hospitals
git merge main                    # bring it into your branch
# Because you only touched your own files, this finishes without conflicts.
npm install                       # only needed if package.json changed
npm run db:setup                  # only needed if database/*.sql changed
git push
```

### Open the Pull Request (PR)

**On the GitHub website (easiest):**

1. Open the repository -> a yellow banner shows **"Compare & pull request"** -> click it. (Or: *Pull requests* -> *New pull request* -> base: `main`, compare: your branch.)
2. Title: `feat(hospitals): hospital search, ICU/CCU and recommendation (Member 2)`.
3. The description box is filled by our template: tick the checkboxes honestly.
4. Click **Create pull request**. Wait for the green tick of the **HealthHub Tests** check (GitHub Actions).
5. Ask one teammate to review: they open *Files changed*, read your code, and click *Review changes -> Approve*.
6. Click **Merge pull request** -> **Confirm merge** (use "Create a merge commit" so every member's commits stay visible in history).
7. Click **Delete branch** (GitHub offers it).

**With the GitHub CLI (optional):**

```bash
gh pr create --base main --title "feat(hospitals): hospital search, ICU/CCU and recommendation" --body "Adds Member 2 module. Tests pass."
```

### After your PR is merged

```bash
git checkout main
git pull origin main
git branch -d feature/member-2-hospitals    # delete the old local branch
```

### Review rule

Nobody merges their own PR. Review checklist: only the owner's files changed; code follows the coding standard (tabs, single quotes, semicolons, `===`, JSDoc); tests pass; no `.env` or passwords in the code.

### If you still get a merge conflict

It almost always means someone edited a file that is not theirs. Do this:

```bash
git merge main                  # Git says: CONFLICT in <file>
# open <file>; look for the markers:
# <<<<<<< HEAD
#   your lines
# =======
#   their lines
# >>>>>>> main
# keep the correct lines, delete the 3 marker lines, save
git add <file>
git commit -m "chore: resolve merge conflict in <file>"
git push
```

Then tell the team which shared file was touched, so it is not repeated.

### Final release (Team Lead)

```bash
git checkout main
git pull origin main
npm run db:setup && npm test        # everything green?
git tag -a v1.0 -m "HealthHub final submission"
git push origin v1.0
```

### Short script: "Explain your Git workflow"

> "We kept one `main` branch protected on GitHub. The team lead pushed a skeleton on Day 0 with the shared files, the database scripts and an empty route file for every module, and `app.js` already mounted all routes. After that every member made their own branch called `feature/member-N-name`, created only their own model, controller, route, view and test files, and committed with `git add` on named files. Each day we pulled `main` and merged it into our branch. Because nobody edited another person's file, merges had no conflicts. Then we opened a Pull Request, GitHub Actions ran our tests, a teammate reviewed it, and we merged with a merge commit. Finally the lead tagged `v1.0`."

---

# SECTION 2 - Module breakdown (summary)

| Member | Module | SRS items | Tables | API endpoints | Detailed guide |
|---|---|---|---|---|---|
| 1 | Authentication + Dashboard | 3.1.1, 3.1.2 | `users` | 4 | `docs/viva/member-1.md` |
| 2 | Hospital Search, ICU/CCU, Recommendation | 3.1.3, 3.1.9, 3.1.10 | `hospitals` | 4 | `docs/viva/member-2.md` |
| 3 | Doctor Profile + Appointments | 3.1.4 | `doctors`, `appointment_slots`, `appointments`, `notifications` | 8 | `docs/viva/member-3.md` |
| 4 | Payment + Health Records | 3.1.12, 3.1.13 | `payments`, `health_records` | 9 | `docs/viva/member-4.md` |
| 5 | Emergency Contacts + Ambulance | 3.1.8, 3.1.11 | `emergency_contacts`, `ambulance_services` | 8 | `docs/viva/member-5.md` |
| 6 | Blood Bank + Vaccine/Anti-venom | 3.1.6, 3.1.7 | `blood_banks`, `blood_inventory`, `vaccines`, `vaccine_stock` | 3 | `docs/viva/member-6.md` |

Each member document has: responsibility, files, branch commands, complete commented code, a viva script (why Model / Controller / View / Route, the SQL explained, block-by-block notes, tests, questions with answers, and a demo script).

## Questions every member should be able to answer

**What is MVC and how does our project follow it?**
MVC splits the program into three jobs. The Model talks to the database. The View is what the user sees. The Controller connects them. In our project the Model files only contain SQL, the View files are HTML pages with small browser scripts, and the Controller files check the request, call the Model and send JSON. Routes connect a URL to a controller function.

**Why do we separate them?**
We can change one part without breaking the others. For example, we can redesign `login.html` without touching `user-model.js`, and we can change a SQL query without touching the page. Six people can also work on separate files without conflicts.

**What is the difference between a route, a controller and a model?**
The route says *which function* handles a URL. The controller says *what should happen* (rules and answer). The model says *how data is read or saved* (SQL).

**What is `pool.execute( sql, [ values ] )`?**
It runs a SQL query with placeholders (`?`). The values are sent separately from the SQL text, so user input can never change the meaning of the query (no SQL injection). The pool reuses a few open connections, which is faster than opening a new one for each request.

**Why `async` / `await`?**
Database calls take time. `await` pauses only that function until the database answers, while the server can handle other users. It is easier to read than callbacks.

**Why `try / catch` in every controller function?**
If the database fails, we catch the error, write it to the console for developers, and send a friendly 500 message instead of crashing the server (this is also the coding-standard rule "always handle exceptions").

**What do the status codes mean?**
200 OK, 201 created, 202 accepted/pending, 400 bad input, 401 not logged in, 402 payment failed, 403 not allowed for your role, 404 not found, 409 conflict (duplicate or already taken), 500 server error.

**How does the browser page talk to the server?**
With `fetch()`. The page sends a request such as `GET /api/hospitals/search?city=Dhaka`, the server answers with JSON, and the page script draws the table.

**How is the system secure?**
Passwords are hashed with bcrypt; every SQL value uses `?` placeholders; search text is validated; pages use `escapeHtml` before `innerHTML`; protected routes use `requireLogin` / `requireRole` on the server; patients can only open their own appointments, payments and records; card numbers are never stored in full.

---

# SECTION 3 - Testing strategy (beginner level)

## 3.1 Tools

- **Vitest** runs the tests (the team's chosen tool).
- **Supertest** lets a test call our Express app like a browser would, without opening a port.
- **GitHub Actions** runs `npm test` on every push and pull request (`.github/workflows/test.yml`). It starts a MySQL 8 service, runs `npm run db:setup`, then `npm test`.

## 3.2 Script: unit testing vs integration testing

> **Unit test** = we test one small function alone. No database, no server. Example: `validateRegistration( body )` is given a body with different passwords and we check it returns `'Password and Confirm Password do not match.'`. It runs in milliseconds, and when it fails we know exactly which function is wrong.
>
> **Integration test** = we test several parts working together: the route, the controller, the model and the real MySQL database. Example: with Supertest we send `POST /api/auth/register` twice with the same email, and we check the first answer is `201` and the second is `409 Email already exists.` It is slower but proves the whole chain works.
>
> In HealthHub every member has both. Unit tests are in `tests/unit`. Integration tests are in `tests/integration`.
>
> **How we ran them:** after `npm run db:setup` we ran `npm run test:unit` (32 tests), `npm run test:integration` (78 tests), or `npm test` for all. Test files run one after another (`fileParallelism: false`) because they share one database. Tests that create data (a user, an appointment, a record) delete it afterwards, so the tests can be run again and again.

## 3.3 npm scripts

| Command | What it does |
|---|---|
| `npm run db:setup` | Drops and recreates the `healthhub` database with demo data. Run before the first test run. |
| `npm run test:unit` | Only `tests/unit`. No database needed. |
| `npm run test:integration` | Only `tests/integration` (needs MySQL + `db:setup`). |
| `npm test` | Everything. |
| `npm run docs` | Builds the JSDoc HTML pages into `docs/jsdoc/index.html`. |

## 3.4 What each member's tests cover

| Member | Unit tests (file) | Integration tests (file) |
|---|---|---|
| Shared | `validators.test.js` (4): email, phone, search text, id | - |
| 1 | `auth.test.js` (5): registration validation | `auth.test.js` (9): register 201 / duplicate 409 / mismatch 400, password stored as hash, login 200 / 401 / 404, session + logout, guest blocked |
| 2 | `hospital.test.js` (5): `buildHospitalSearch` (injection stays in params), `areSearchTextsValid` | `hospital.test.js` (13): search, no match, invalid text 400, SQL-injection text, details 200 / 404 / 400, ICU filter, recommendation order and max cost |
| 3 | `appointment.test.js` (2): `validateSlotId` | `appointment.test.js` (13): doctor search/profile, guest 401, doctor 403, invalid slot, booking, double booking 409, reschedule, cancel twice, notifications, doctor schedule |
| 4 | `payment.test.js` (10): payment validation, gateway rules, transaction reference, file type, record validation | `payment.test.js` (8): summary, failed 402, success 201, duplicate 409, history, receipt. `health-record.test.js` (9): upload, wrong type, too big, no file, list, download, 403, delete |
| 5 | `emergency-ambulance.test.js` (3): `validateContactInput` | `emergency-ambulance.test.js` (15): search, add / update / delete, duplicate 409, role checks 401 / 403, ambulance search and availability |
| 6 | `blood-vaccine.test.js` (3): blood group helpers | `blood-vaccine.test.js` (11): blood search, unavailable, none, fake group, details, vaccine search, filter, unavailable, not found |

## 3.5 How to write a new test (template)

Unit test (a plain function):

```js
import { describe, it, expect } from 'vitest';
import authController from '../../controllers/auth-controller.js';

const { validateRegistration } = authController;

describe( 'validateRegistration', () => {
	it( 'rejects a short password', () => {
		const body = { /* ...a full valid form... */ password: '123', confirmPassword: '123' };
		expect( validateRegistration( body ) ).toBe( 'Password must be at least 6 characters.' );
	} );
} );
```

Integration test (a real API call):

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe( 'Hospital search API', () => {
	it( 'finds hospitals by city (200)', async () => {
		const response = await request( app ).get( '/api/hospitals/search' ).query( { city: 'Dhaka' } );
		expect( response.status ).toBe( 200 );
		expect( response.body.data.length ).toBeGreaterThan( 0 );
	} );
} );
```

For a logged-in test use the helper: `const patient = await loginAs( 'patient@healthhub.com' );` then `patient.get( '/api/appointments/my' )`.

---

# SECTION 4 - Coding standard checklist (before every PR)

- [ ] `camelCase` for variables and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants, boolean names start with `is` / `has` / `can` / `should`.
- [ ] `const` / `let` only (never `var`); `===` and `!==` only.
- [ ] Tabs for indentation, single quotes, a semicolon at the end of every statement, braces on every `if`.
- [ ] Spaces around operators and inside parentheses: `bookAppointment( patientId, doctorId );`
- [ ] File names in lowercase kebab-case: `appointment-controller.js`.
- [ ] Every function has a JSDoc comment (description, `@param`, `@returns`). Comments explain **why**, not what.
- [ ] Every `async` function that touches the database uses `try / catch`.
- [ ] One function = one job. No copied code (shared things go to `utils/validators.js` or a constant).
- [ ] `npm run docs` works (JSDoc builds without errors).

# SECTION 5 - Before the viva

1. `git clone` your own repo into a **new empty folder** and follow the root `README.md` exactly (this is what the teacher will do).
2. `npm run db:setup`, `npm start`, open every page once, `npm test` (all green).
3. Each member opens their `docs/viva/member-N.md`, reads section 5, and practises the demo script.
4. Be ready to open any of your files and say: "this part is Model / View / Controller / Route because ...".
5. Know the limits listed in section 0, and say them honestly.

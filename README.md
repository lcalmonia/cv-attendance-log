# CV Log – Multi-Business Attendance & Payroll

CV Log is a simple attendance and payroll web application for multiple businesses.

## Production architecture

- React + Vite frontend
- Netlify Functions for the API
- Netlify Database (managed PostgreSQL) for all application data
- HttpOnly secure session cookie for authentication
- Responsive UI for desktop and mobile browsers
- No application data is stored in browser localStorage

Schedules and attendance are stored as relational records in Netlify Database. Schedule uniqueness is enforced by employee + payroll period + date. Attendance uniqueness is enforced by employee + date.

Attendance timestamps are stored as UTC timestamps, while payroll/schedule date and lateness calculations use Asia/Manila.

## Roles

### Super Admin
- Create and manage businesses
- Create and manage employees
- Assign employees to businesses
- Create payroll cut-off periods
- Create date-by-date schedules per employee
- View attendance logs
- Configure recurring and employee-specific deductions
- Configure incentive programs
- Review payroll
- Move payroll through approval/finalization statuses

### Employee
- Sign in
- Change password
- View today's schedule
- Time In / Break Out / Break In / Time Out
- View schedules
- View attendance
- View tentative payroll
- Approve payroll when submitted for approval
- View/print payslip

## Netlify deployment

1. Import the repository into Netlify.
2. Use build command `npm run build` and publish directory `dist`.
3. Functions are in `netlify/functions`.
4. Enable Netlify Database for the site.
5. Deploy the site. Migrations in `netlify/database/migrations` create the application tables.
6. On the first visit, the login screen provides the one-time Initialize Super Admin setup when no Super Admin exists.

The API must use Netlify Database as the authoritative datastore. Do not replace it with files, Blobs, localStorage, or in-memory state.

## Local development

Run the complete stack with:

```bash
npm install
npm run dev
```

For a build/type check:

```bash
npm run build
npm run lint
```

## Production notes

- Do not commit real credentials.
- Do not add demo passwords or demo employee accounts to production data.
- Employee login credentials are stored as password hashes.
- Session tokens are kept in an HttpOnly cookie and only their hashes are stored in the database.

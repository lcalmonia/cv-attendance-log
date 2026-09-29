# CV Log – Multi-Business Attendance & Payroll System

Simple, clean multi-business attendance and payroll web application built for the **CV Group of Companies**.

## Overview

CV Log is an intuitive attendance and payroll management portal designed around simplicity and reliability:
- **Two Roles**: Super Admin and Employee.
- **Multi-Business Support**: Employees belong to an assigned enterprise (e.g. CV Group of Companies, iLuvKeyks Coffee & Tea, HydraPure Water Refilling Station).
- **Flexible Scheduling**: Date-by-date schedule assignment per employee before each cut-off (no hard-coded working hours, supports scheduled OFF days).
- **Live Attendance Logging**: Streamlined clock station supporting Time In, Break Out, Break In, and Time Out with automated lateness and duration calculations.
- **Configurable Deductions**: Common recurring contributions (SSS, PhilHealth, Pag-IBIG) and employee-specific deductions (Cash advance, uniform, etc.).
- **Attendance Incentives**: Active performance programs (such as perfect attendance bonuses) evaluated against scheduled duty shifts.
- **Tentative & Final Payroll**: Real-time tentative payroll projection, formal employee approval workflow, and printable/downloadable payslip vouchers.
- **Server-Side Security**: Authentication and role-based authorization enforced strictly on all server endpoints.

---

## Default Access Credentials

- **Super Admin**: `CVG-ADM-001` / `AdminPassword123!`
- **Employee 1**: `ILK-EMP-101` / `ILK-EMP-101` (Joshua De Leon – iLuvKeyks)
- **Employee 2**: `HPW-EMP-201` / `HPW-EMP-201` (Maria Elena Santos – HydraPure)
- **Employee 3**: `HPW-EMP-202` / `HPW-EMP-202` (Rico Bautista – HydraPure)

*Note: Newly registered employees receive a temporary password equal to their Employee ID and are required to set a permanent password upon first login.*

---

## Local Development & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Production Build**:
   ```bash
   npm run build
   ```

4. **Production Start**:
   ```bash
   npm start
   ```

---

## Deployment Instructions

### Deploy to Netlify / Cloud Hosting

1. **Repository**: Push this repository to GitHub or GitLab.
2. **Import into Netlify**:
   - Build Command: `npm run build`
   - Publish Directory: `dist`
3. **Environment**:
   - Ensure Node.js runtime is set to version 20 or 22.
4. **Data Persistence**:
   - All accounts, employee assignments, schedules, clock records, deductions, and payroll periods are saved in `.data/cvlog_db.json`.

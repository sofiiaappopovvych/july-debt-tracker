# July Debt Tracker — Production Ready

A mobile-friendly debt payoff tracker for July. It works on phone and desktop, can run locally with `localStorage`, and can sync between devices through Firebase Google Sign-In + Firestore.

## Core formula

```text
Remaining Debt = Starting Debt - Starting Cash - Total Cash In + Total Expenses + Target Cushion
```

If Remaining Debt goes below zero, the app shows:

- Remaining Debt: `$0`
- Surplus: the extra amount above the goal

## Included features

- Empty first launch: no demo values, no hardcoded fake totals.
- Setup screen/settings for:
  - Starting Debt
  - Starting Cash / Available Funds
  - Target Cushion
  - Payment Date
- July Goal Dashboard:
  - Remaining Debt
  - Days Until Payment
  - Needed Per Day
  - Progress Bar
  - Goal Status
  - Surplus
- Income groups:
  - Earned Income: School, DoorDash, Sales Commission, Animator, Freelance, Other Work
  - Refunds: Amazon, Walmart, Target, Other Refund
  - Sold Items: Vinted, Facebook Marketplace, OfferUp, eBay, Other Sold Item
  - Gifts: Birthday, Family, Other Gift
  - Other
- Expense categories:
  - Tesla
  - Charging/Gas
  - Food
  - Supplies
  - Personal
  - Bills
  - Other
- Quick Add form:
  - date
  - transaction type
  - group
  - category/source
  - amount
  - note
- Quick Add buttons:
  - +DoorDash
  - +School
  - +Sales
  - +Vinted
  - +Refund
  - +Gift
  - -Expense
- Transaction History:
  - newest first
  - edit/delete
  - search by note/source/category
- July Calendar View:
  - income
  - expenses
  - net
  - remaining debt after each day
  - current day highlight
  - source/category filters
- Daily Log
- Export / Import:
  - Export JSON Backup
  - Import JSON Backup
  - Export CSV for Excel / Google Sheets
- Mobile app-like interface:
  - Dashboard
  - Add
  - Calendar
  - History
  - Settings
  - iPhone safe-area padding
  - no horizontal page scroll

## Files

```text
index.html
styles.css
app.js
firebase-config.js
README.md
```

## GitHub Pages setup

1. Create a GitHub repository.
2. Upload all files from this ZIP into the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Save.
6. Open the GitHub Pages link.

## Firebase setup for sync

### 1. Create Firebase project

1. Go to Firebase Console.
2. Click **Add project**.
3. Name it, for example: `July Debt Tracker`.
4. Google Analytics is optional.

### 2. Add Web App

1. Inside the Firebase project, click the web icon `</>`.
2. Register the app.
3. Copy the Firebase config.

It will look like this:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3. Update `firebase-config.js`

Replace:

```js
export const firebaseConfig = null;
```

with:

```js
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Enable Google Auth

1. Firebase Console → **Authentication**.
2. Click **Get started**.
3. Go to **Sign-in method**.
4. Enable **Google**.
5. Save.

### 5. Add Authorized Domain

Firebase Console → **Authentication → Settings → Authorized domains**.

Add your GitHub Pages domain:

```text
YOUR_GITHUB_USERNAME.github.io
```

### 6. Create Firestore database

1. Firebase Console → **Firestore Database**.
2. Click **Create database**.
3. Choose production mode or test mode.
4. Choose a location.

### 7. Firestore rules

Use these private-per-user rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/apps/{appId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Publish the rules.

## Storage behavior

### Signed out

The app saves data only on the current device in `localStorage`.

### Signed in

The app saves and syncs data in Firestore here:

```text
users/{user.uid}/apps/julyDebtTracker
```

Use the same Google account on phone and computer to sync.

## Testing checklist

### Empty state

- [ ] Open the site for the first time.
- [ ] Confirm all cards show `$0`.
- [ ] Confirm there are no demo transactions.
- [ ] Confirm there are no fake values like `$2,790`, `$780`, `$4,790`.

### Settings + formula

- [ ] Enter Starting Debt.
- [ ] Enter Starting Cash / Available Funds.
- [ ] Enter Target Cushion.
- [ ] Enter Payment Date.
- [ ] Click Save Settings.
- [ ] Confirm formula works:

```text
Remaining Debt = Starting Debt - Starting Cash - Total Cash In + Total Expenses + Target Cushion
```

### Income

- [ ] Add School income.
- [ ] Add DoorDash income.
- [ ] Add Sales Commission income.
- [ ] Add Refund income.
- [ ] Confirm Earned Income, Refunds, Sold Items, Gifts, and Total Cash In update correctly.

### Expenses

- [ ] Add Tesla expense.
- [ ] Add Food or Charging/Gas expense.
- [ ] Confirm Total Expenses increases.
- [ ] Confirm Remaining Debt increases when an expense is added.

### Surplus

- [ ] Add enough income to exceed the debt goal.
- [ ] Confirm Remaining Debt shows `$0`.
- [ ] Confirm Surplus card shows the extra amount.

### Edit/delete

- [ ] Edit an income transaction.
- [ ] Delete an expense transaction.
- [ ] Confirm all dashboard cards recalculate.

### Search

- [ ] Search by source.
- [ ] Search by category.
- [ ] Search by note.

### Calendar

- [ ] Open Calendar tab.
- [ ] Confirm July days show income, expenses, net, and remaining debt.
- [ ] Confirm today is highlighted.
- [ ] Test income source filter.
- [ ] Test expense category filter.

### Export/import

- [ ] Export JSON backup.
- [ ] Export CSV and open it in Excel/Google Sheets.
- [ ] Import JSON backup.
- [ ] Confirm settings and transactions restore.

### Firebase sync

- [ ] Add real Firebase config.
- [ ] Deploy to GitHub Pages.
- [ ] Sign in with Google on phone.
- [ ] Sign in with same Google account on computer.
- [ ] Add a transaction on one device.
- [ ] Confirm it appears on the other device.
- [ ] Edit/delete a transaction and confirm sync.

### Mobile layout

- [ ] Open on iPhone.
- [ ] Check Dashboard/Add/Calendar/History/Settings bottom navigation.
- [ ] Confirm no horizontal page scroll.
- [ ] Confirm buttons are easy to tap.
- [ ] Confirm bottom nav does not cover important content.

## Notes

- Keep `firebase-config.js` as `null` if you only want local mode.
- Firebase config is safe to include in frontend code, but Firestore rules must be private.
- If Google Sign-In fails, check Authorized Domains.
- If sync fails, check Firestore rules and the browser console.

## School Paycheck Calculator

The Add screen includes a School Paycheck Calculator. Enter the work date and hours worked. The app will:

- calculate gross pay using the hourly rate,
- estimate net pay using the net percentage,
- find the matching 2026–2027 semi-monthly payroll period,
- save the estimated income on the expected payday.

Default values are based on the sample paystub: $20.81/hour and about 83.05% net pay ($570.32 net from $686.73 gross). This is only an estimate; actual taxes/deductions can change by paycheck.

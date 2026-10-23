# Document Follow-Up Tracker

An internal Khmer/English case tracker for an accounting and business-services office. The app runs in a browser, but all data is stored in one Excel workbook so it can still be opened, copied, and backed up outside the app.

## What it does

- Tracks clients, cases, ministries, statuses, activities, signatures, and notes.
- Shows a Today dashboard with open cases, waiting cases, overdue cases, and completed cases this month.
- Supports Khmer and English, light and dark themes.
- Provides quick activity entry, reusable activity templates, and configurable service types, ministries, status labels, and warning thresholds.
- Generates public read-only share links for clients. Shared pages do not expose internal notes or signatures.
- Uses one shared office password. There are no user accounts or roles.
- Writes to `data/tracker.xlsx` with atomic file replacement, a write queue, and daily backups. The last 30 backups are kept.

## Requirements

- Node.js 20.9 or newer.
- npm.
- Microsoft Excel is optional, but close `data/tracker.xlsx` before saving anything in the app.

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create `.env` from `.env.example` and set a strong password and session secret:

   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated value into `SESSION_SECRET`. Set `APP_PASSWORD` to the password the office will share.

3. Start the development server:

   ```powershell
   npm run dev
   ```

4. Open `http://localhost:3000`.

For a production-style local run:

```powershell
npm run build
npm run start
```

To use the app from another device on the same office network:

```powershell
npm run build
npm run start -- --hostname 0.0.0.0
```

Then open `http://<office-computer-ip>:3000` from the other device. Allow port 3000 through the firewall. Do not expose this app directly to the internet. If it is placed behind HTTPS, set `SESSION_COOKIE_SECURE=true` in `.env`.

## Deploy online (Render)

The app needs a persistent disk because it writes `data/tracker.xlsx`. Render's Starter plan supports persistent disks, so the included `render.yaml` creates:

- A Node web service built with `npm ci && npm run build` and started with `npm start`.
- A 1 GB disk mounted at `/var/data`, with `DATA_DIR=/var/data`.
- HTTPS cookie protection through `SESSION_COOKIE_SECURE=true`.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/ChhounSoktharnak303/FollowUpDocumentsClient)

Sign in with GitHub, choose a region, and set the two secrets when prompted:

- `APP_PASSWORD`: the shared office password. Do not reuse the local demo password.
- `SESSION_SECRET`: at least 32 random characters. Generate one with:

  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

The online instance starts with a fresh, empty workbook on the disk. Keep exactly one instance running against one workbook. Anyone with the URL can reach the login page, so use a strong `APP_PASSWORD`.

## Data storage

The workbook is `data/tracker.xlsx` and contains these sheets:

| Sheet | Purpose |
| --- | --- |
| `Clients` | Client names, phone, note, creation time |
| `Cases` | Service, ministry, dates, status, share token |
| `Activities` | Dated activity log, ministry, status, signature, note |
| `Templates` | Reusable Khmer/English activity text |
| `Settings` | Service types, ministries, status labels, warning thresholds |

Rules:

- Keep the sheet names and header row unchanged.
- Close Excel before saving in the app. If Excel has the file open, the API returns HTTP `423` and asks the user to close the file.
- Run only one app instance against one workbook.
- Backups are in `data/backups/`. To restore, stop the app and copy a backup over `data/tracker.xlsx`.
- Do not edit `data/tracker.xlsx` in Excel while the app is running.

## Demo data

The seed script creates three clients, five cases, and nine activities. It only runs on an empty workbook.

```powershell
# Back up and remove the current workbook first
Move-Item data/tracker.xlsx data/tracker.before-seed.xlsx
npm run seed
```

The app will create a fresh workbook if `data/tracker.xlsx` does not exist.

## Import the legacy tracker

The default source file is:

```text
data/legacy/Document_Follow_Up_Tracker.xlsx
```

Copy the full legacy workbook there. The smaller `Document_Follow_Up_Tracker_KH (2).xlsx` file is an older partial copy and is not used by default.

Import into an empty workbook only:

```powershell
# Stop the app first. Back up the current workbook.
Move-Item data/tracker.xlsx data/tracker.before-import.xlsx

npm run import
```

To import a different file:

```powershell
npm run import -- "C:\path\to\Document_Follow_Up_Tracker.xlsx"
```

The import:

- Reads the `ទិដ្ឋភាពទូទៅ` overview sheet.
- Reads one activity log from each client sheet.
- Ignores `Sheet1`.
- Merges overview ministry rows into the case journey.
- Converts Excel date cells, serial dates, and day/month/year text dates to `YYYY-MM-DD`.
- Deduplicates identical activities.
- Creates missing service or ministry options in Settings.
- Refuses to run if `data/tracker.xlsx` already contains clients or cases.
- Writes an audit report to `data/legacy/import-report.json`.

Review the report after importing. It records warnings such as out-of-order dates, activities earlier than the overview start, duplicate rows, and corrected future end dates. The current migration imported 10 clients, 10 cases, and 35 activities. One duplicate activity was skipped. The report is ignored by Git.

## Status and date rules

- Case statuses: `in_progress`, `waiting`, `done`, `success`, `rejected`.
- Activity statuses: `in_progress`, `waiting`, `done`, `rejected`.
- Status codes are fixed internally. Their English and Khmer labels are editable in Settings.
- A new activity updates the case ministry to the activity ministry.
- An activity with status `rejected` marks the case as rejected.
- Closed cases are `done` or `success`.
- Warning thresholds default to orange at 7 days and red at 14 days.
- Dates are stored as ISO `YYYY-MM-DD` strings in Excel.

## Public share links

Each case has a share token. The link is:

```text
/track/<token>
```

The page is public and read-only. It shows the client name, service, ministry, dates, status, and activity timeline. It does not show internal notes or signatures. Regenerating a share token immediately invalidates the old link.

## Useful commands

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run seed
npm run import
```

## Troubleshooting

**The app says the Excel file is locked.**
Close `data/tracker.xlsx` in Excel, then try again.

**Import says the workbook already has data.**
The import is intentionally non-destructive. Back up and remove `data/tracker.xlsx`, then run `npm run import`.

**The password does not work.**
Check `APP_PASSWORD` in `.env` and restart the app.

**The session secret error appears.**
Set `SESSION_SECRET` to at least 32 characters in `.env`.

**Khmer text looks wrong in PowerShell.**
PowerShell may display Khmer incorrectly. The app and Excel data are UTF-8. Inspect the import report or the app in a browser instead of relying on console output.

## Current limitations

- One shared password; no individual users or permissions.
- No Telegram, email, or SMS reminders.
- No built-in Excel/PDF export yet. Use the workbook or the browser print button.
- No multi-office sync. The workbook is the single source of truth.

---

# កម្មវិធីតាមដានឯកសារ

កម្មវិធីខាងក្នុងសម្រាប់ការិយាល័យគណនេយ្យ និងសេវាអាជីវកម្ម។ កម្មវិធីដំណើរការក្នុងកម្មវិធីរុករក ប៉ុន្តែទិន្នន័យទាំងអស់រក្សាទុកក្នុងឯកសារ Excel តែមួយ ដើម្បីអាចបើក ចម្លង និងបម្រុងទុកនៅខាងក្រៅកម្មវិធីបាន។

## មុខងារ

- គ្រប់គ្រងអតិថិជន ករណី ក្រសួង ស្ថានភាព សកម្មភាព ហត្ថលេខា និងកំណត់ចំណាំ។
- ទំព័រ “ថ្ងៃនេះ” បង្ហាញករណីកំពុងដំណើរការ ករណីរង់ចាំ ករណីហួសកំណត់ និងករណីបានបញ្ចប់ក្នុងខែនេះ។
- គាំទ្រភាសាខ្មែរ និងអង់គ្លេស ព្រមទាំងផ្ទាំងភ្លឺ និងងងឹត។
- បញ្ចូលសកម្មភាពរហ័ស ប្រើពុម្ពសកម្មភាពឡើងវិញ និងកំណត់ប្រភេទសេវា ក្រសួង ស្លាកស្ថានភាព និងកម្រិតព្រមានបាន។
- បង្កើតតំណចែករំលែកសាធារណៈសម្រាប់អតិថិជន។ ទំព័រចែករំលែកមិនបង្ហាញកំណត់ចំណាំខាងក្នុង ឬហត្ថលេខាទេ។
- ប្រើពាក្យសម្ងាត់រួមមួយសម្រាប់ការិយាល័យ។ មិនមានគណនីអ្នកប្រើ ឬសិទ្ធិដាច់ដោយឡែកទេ។
- សរសេរទៅ `data/tracker.xlsx` ដោយប្រើវិធីសរសេរប្រកបដោយសុវត្ថិភាព ជាមួយជួរសរសេរ និងការបម្រុងទុកប្រចាំថ្ងៃ។ រក្សាទុក 30 ច្បាប់ចុងក្រោយ។

## តម្រូវការ

- Node.js 20.9 ឬថ្មីជាងនេះ។
- npm។
- Microsoft Excel មិនចាំបាច់ទេ ប៉ុន្តែត្រូវបិទ `data/tracker.xlsx` មុនពេលរក្សាទុកក្នុងកម្មវិធី។

## ការដំឡើង

1. ដំឡើង dependencies:

   ```powershell
   npm install
   ```

2. បង្កើត `.env` ពី `.env.example` ហើយកំណត់ពាក្យសម្ងាត់ និង session secret:

   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   ដាក់តម្លៃដែលបានបង្កើតក្នុង `SESSION_SECRET`។ កំណត់ `APP_PASSWORD` ជាពាក្យសម្ងាត់ដែលការិយាល័យនឹងប្រើរួមគ្នា។

3. ចាប់ផ្តើម development server:

   ```powershell
   npm run dev
   ```

4. បើក `http://localhost:3000`។

សម្រាប់ការដំណើរការបែប production ក្នុងកុំព្យូទ័រតែមួយ:

```powershell
npm run build
npm run start
```

ដើម្បីប្រើពីឧបករណ៍ផ្សេងក្នុងបណ្តាញការិយាល័យតែមួយ:

```powershell
npm run build
npm run start -- --hostname 0.0.0.0
```

បន្ទាប់មកបើក `http://<IP-កុំព្យូទ័រការិយាល័យ>:3000` ពីឧបករណ៍ផ្សេង។ អនុញ្ញាត port 3000 តាម firewall។ មិនត្រូវបើកកម្មវិធីនេះដោយផ្ទាល់ទៅអ៊ីនធឺណិតទេ។ ប្រសិនបើដាក់នៅខាងក្រោយ HTTPS សូមកំណត់ `SESSION_COOKIE_SECURE=true` ក្នុង `.env`។

## ការរក្សាទុកទិន្នន័យ

ឯកសារ Excel គឺ `data/tracker.xlsx` និងមានសន្លឹកទាំងនេះ:

| សន្លឹក | គោលបំណង |
| --- | --- |
| `Clients` | ឈ្មោះអតិថិជន លេខទូរស័ព្ទ កំណត់ចំណាំ ពេលបង្កើត |
| `Cases` | សេវា ក្រសួង កាលបរិច្ឆេទ ស្ថានភាព share token |
| `Activities` | កំណត់ហេតុសកម្មភាពតាមកាលបរិច្ឆេទ ក្រសួង ស្ថានភាព ហត្ថលេខា កំណត់ចំណាំ |
| `Templates` | អត្ថបទសកម្មភាពខ្មែរ/អង់គ្លេសសម្រាប់ប្រើឡើងវិញ |
| `Settings` | ប្រភេទសេវា ក្រសួង ស្លាកស្ថានភាព កម្រិតព្រមាន |

ច្បាប់:

- រក្សាឈ្មោះសន្លឹក និងជួរក្បាលដើម។
- បិទ Excel មុនពេលរក្សាទុកក្នុងកម្មវិធី។ ប្រសិនបើ Excel បើកឯកសារ API នឹងត្រឡប់ HTTP `423` និងសុំឱ្យបិទឯកសារ។
- ដំណើរការកម្មវិធីតែមួយប៉ុណ្ណោះលើឯកសារ Excel មួយ។
- ការបម្រុងទុកស្ថិតក្នុង `data/backups/`។ ដើម្បីស្តារឡើងវិញ សូមបញ្ឈប់កម្មវិធី ហើយចម្លងឯកសារបម្រុងទុកទៅ `data/tracker.xlsx`។
- មិនត្រូវកែ `data/tracker.xlsx` ក្នុង Excel ខណៈកម្មវិធីកំពុងដំណើរការទេ។

## ទិន្នន័យសាកល្បង

Script seed បង្កើតអតិថិជន 3 ករណី 5 និងសកម្មភាព 9។ វាដំណើរការតែលើឯកសារ Excel ទទេប៉ុណ្ណោះ។

```powershell
# បម្រុងទុក និងដកឯកសារបច្ចុប្បន្នចេញជាមុន
Move-Item data/tracker.xlsx data/tracker.before-seed.xlsx
npm run seed
```

កម្មវិធីនឹងបង្កើតឯកសារ Excel ថ្មី ប្រសិនបើ `data/tracker.xlsx` មិនមាន។

## នាំចូលឯកសារចាស់

ឯកសារដើមលំនាំដើម:

```text
data/legacy/Document_Follow_Up_Tracker.xlsx
```

ចម្លងឯកសារចាស់ពេញលេញទៅទីនោះ។ ឯកសារ `Document_Follow_Up_Tracker_KH (2).xlsx` តូចជាង គឺជាច្បាប់ចាស់មិនពេញលេញ ហើយមិនត្រូវប្រើតាមលំនាំដើមទេ។

នាំចូលទៅឯកសារ Excel ទទេតែប៉ុណ្ណោះ:

```powershell
# បញ្ឈប់កម្មវិធីជាមុន។ បម្រុងទុកឯកសារបច្ចុប្បន្ន។
Move-Item data/tracker.xlsx data/tracker.before-import.xlsx

npm run import
```

ដើម្បីនាំចូលឯកសារផ្សេង:

```powershell
npm run import -- "C:\path\to\Document_Follow_Up_Tracker.xlsx"
```

ការនាំចូលនឹង:

- អានសន្លឹកសង្ខេប `ទិដ្ឋភាពទូទៅ`។
- អានកំណត់ហេតុសកម្មភាពពីសន្លឹកអតិថិជនម្នាក់ៗ។
- មិនអាន `Sheet1`។
- បញ្ចូលជួរក្រសួងពីសន្លឹកសង្ខេបទៅក្នុងដំណើរការករណី។
- បំប្លែងកាលបរិច្ឆេទ Excel លេខ serial និងអត្ថបទ ថ្ងៃ/ខែ/ឆ្នាំ ទៅ `YYYY-MM-DD`។
- លុបសកម្មភាពដូចគ្នាដែលស្ទួន។
- បង្កើតជម្រើសសេវា ឬក្រសួងដែលខ្វះក្នុង Settings។
- មិនដំណើរការ ប្រសិនបើ `data/tracker.xlsx` មានអតិថិជន ឬករណីរួចហើយ។
- សរសេររបាយការណ៍ត្រួតពិនិត្យទៅ `data/legacy/import-report.json`។

សូមពិនិត្យរបាយការណ៍ក្រោយការនាំចូល។ វាកត់ត្រាការព្រមានដូចជា កាលបរិច្ឆេទមិនតាមលំដាប់ សកម្មភាពមុនថ្ងៃចាប់ផ្តើម ជួរស្ទួន និងថ្ងៃបញ្ចប់នៅអនាគតដែលបានកែ។ ការនាំចូលបច្ចុប្បន្នបាននាំចូលអតិថិជន 10 ករណី 10 និងសកម្មភាព 35។ សកម្មភាពស្ទួន 1 ត្រូវបានលុប។ របាយការណ៍ត្រូវបានមិនរាប់បញ្ចូលដោយ Git។

## ច្បាប់ស្ថានភាព និងកាលបរិច្ឆេទ

- ស្ថានភាពករណី: `in_progress`, `waiting`, `done`, `success`, `rejected`។
- ស្ថានភាពសកម្មភាព: `in_progress`, `waiting`, `done`, `rejected`។
- កូដស្ថានភាពជាក់លាក់។ ស្លាកខ្មែរ និងអង់គ្លេសអាចកែក្នុង Settings។
- សកម្មភាពថ្មីធ្វើបច្ចុប្បន្នភាពក្រសួងរបស់ករណីទៅក្រសួងសកម្មភាព។
- សកម្មភាពដែលមានស្ថានភាព `rejected` ធ្វើឱ្យករណីក្លាយជា rejected។
- ករណីបញ្ចប់គឺ `done` ឬ `success`។
- កម្រិតព្រមានលំនាំដើម ពណ៌ទឹកក្រូច 7 ថ្ងៃ និងពណ៌ក្រហម 14 ថ្ងៃ។
- កាលបរិច្ឆេទរក្សាទុកជាអត្ថបទ ISO `YYYY-MM-DD` ក្នុង Excel។

## តំណចែករំលែកសាធារណៈ

ករណីមួយៗមាន share token។ តំណគឺ:

```text
/track/<token>
```

ទំព័រនេះជាសាធារណៈ និងអានបានតែប៉ុណ្ណោះ។ វាបង្ហាញឈ្មោះអតិថិជន សេវា ក្រសួង កាលបរិច្ឆេទ ស្ថានភាព និងដំណើរសកម្មភាព។ វាមិនបង្ហាញកំណត់ចំណាំខាងក្នុង ឬហត្ថលេខាទេ។ ការបង្កើត share token ថ្មី ធ្វើឱ្យតំណចាស់ឈប់ដំណើរការភ្លាមៗ។

## ពាក្យបញ្ជាដែលមានប្រយោជន៍

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run seed
npm run import
```

## ការដោះស្រាយបញ្ហា

**កម្មវិធីនិយាយថាឯកសារ Excel ត្រូវបានចាក់សោ។**
បិទ `data/tracker.xlsx` ក្នុង Excel ហើយព្យាយាមម្តងទៀត។

**ការនាំចូលនិយាយថាឯកសារមានទិន្នន័យរួចហើយ។**
ការនាំចូលមិនបំផ្លាញទិន្នន័យដោយចេតនាទេ។ បម្រុងទុក និងដក `data/tracker.xlsx` ចេញ បន្ទាប់មកដំណើរការ `npm run import`។

**ពាក្យសម្ងាត់មិនដំណើរការ។**
ពិនិត្យ `APP_PASSWORD` ក្នុង `.env` ហើយចាប់ផ្តើមកម្មវិធីឡើងវិញ។

**មានកំហុស session secret។**
កំណត់ `SESSION_SECRET` យ៉ាងតិច 32 តួអក្សរក្នុង `.env`។

**អក្សរខ្មែរមើលទៅខុសក្នុង PowerShell។**
PowerShell អាចបង្ហាញខ្មែរមិនត្រឹមត្រូវ។ កម្មវិធីរក្សាទុកអក្សរខ្មែរបានត្រឹមត្រូវ។ សូមពិនិត្យរបាយការណ៍ ឬប្រើកម្មវិធីរុករកជំនួសវិញ។

## ដែនកំណត់បច្ចុប្បន្ន

- ពាក្យសម្ងាត់រួមមួយ; គ្មានអ្នកប្រើ ឬសិទ្ធិដាច់ដោយឡែក។
- គ្មានការរំលឹកតាម Telegram អ៊ីមែល ឬ SMS។
- គ្មានការនាំចេញ Excel/PDF ក្នុងកម្មវិធីនៅឡើយទេ។ ប្រើឯកសារ Excel ឬប៊ូតុង print ក្នុងកម្មវិធីរុករក។
- គ្មានការធ្វើសមកាលកម្មច្រើនការិយាល័យ។ ឯកសារ Excel គឺជាប្រភពទិន្នន័យតែមួយ។

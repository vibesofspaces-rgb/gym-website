# IronForge Gym Website — Setup Guide

## What you need
- A free Google account (Gmail)
- A free GitHub account
- A free Render account

---

## Step 1: Create your Google Sheet

1. Go to https://sheets.new (creates a blank sheet)
2. Rename the sheet to something like "Gym Site Data"
3. Create these tabs (click "+" at bottom):
   - **Classes** — for your class schedule
   - **Content** — for site text (headlines, about text, etc.)
   - **Users** — auto-populated when members register
   - **Bookings** — auto-populated when members book classes
   - **Contacts** — auto-populated via the contact form

### Classes tab — add these columns in the first row:
| id | name | description | time | day | duration | capacity | instructor | active |
|----|------|-------------|------|-----|----------|----------|-----------|--------|
| 1 | Morning Yoga | Start your day... | 06:00 | Monday | 60 | 25 | Sarah Johnson | TRUE |

The first row with column names is **required**. Add your classes below it.

### Content tab — add these columns in the first row:
| key | value |
|-----|-------|
| hero_title | Your Journey Starts Here |
| hero_subtitle | Transform your body... |
| about_heading | Built for those who push harder |
| about_text | IronForge isn't just a gym... |
| contact_email | hello@ironforge.com |
| contact_phone | (555) 123-4567 |
| contact_address | 123 Fitness Street |

---

## Step 2: Enable the Google Sheets API

1. Go to https://console.cloud.google.com
2. Create a new project (click the project dropdown → New Project → name it "gym-website")
3. Go to **APIs & Services** → **Library**
4. Search for "Google Sheets API" → click → **Enable**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **Service Account**
7. Name it "gym-sheets-service" → click **Create and Continue**
8. Skip the next two steps (click **Done**)
9. On the Credentials page, click the service account email you just created
10. Go to the **Keys** tab → **Add Key** → **Create New Key** → **JSON**
11. A JSON file will download. Open it — you'll need:
    - `client_email` (looks like `gym-sheets-service@...gserviceaccount.com`)
    - `private_key` (a long string starting with `-----BEGIN PRIVATE KEY-----`)

---

## Step 3: Share your sheet with the service account

1. Open your Google Sheet
2. Click the **Share** button (top-right)
3. Paste the `client_email` from step 2
4. Set permission to **Editor**
5. Click **Share**
6. Copy the **Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit`

---

## Step 4: Deploy on Render (free)

1. Push this code to a GitHub repository
2. Go to https://dashboard.render.com
3. Click **New** → **Web Service**
4. Connect your GitHub repo
5. Render will auto-detect the settings from `render.yaml`
6. Fill in the environment variables:
   - `GOOGLE_SHEET_ID` — the ID from Step 3
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — from the JSON file
   - `GOOGLE_PRIVATE_KEY` — **the entire key including `-----BEGIN PRIVATE KEY-----`**, in quotes
   - `ADMIN_PASSWORD` — choose a password for your admin panel
7. Click **Create Web Service**
8. Wait 2-3 minutes for deployment
9. Your site is live at `https://your-site.onrender.com`

To update your site, just edit your Google Sheet. Changes reflect within ~30 seconds.

---

## Step 5: Access the admin panel

Go to `https://your-site.onrender.com/admin.html`
Sign in with the `ADMIN_PASSWORD` you set.

---

## Updating your site

- **Change classes**: Edit the **Classes** tab in Google Sheets
- **Change text**: Edit the **Content** tab in Google Sheets
- **View bookings**: Go to the admin panel → Bookings tab
- **Hide a class**: Set `active` to `FALSE` (it won't appear on the site)

No coding needed. Just edit the spreadsheet.

---

## How it works

Google Sheets acts as your database. The website reads from it directly.
- Classes, site text → from Google Sheets (you edit)
- User registrations, bookings, contact messages → written to Google Sheets (by the site)

Everything is free: Google Sheets, Google Cloud (free tier), and Render (free tier).

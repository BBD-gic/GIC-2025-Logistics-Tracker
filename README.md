
# GIC Logistics Tracker – Full Setup Guide

## ✅ What’s Included

- A dynamic HTML form (index.html) that fetches options from Airtable
- A Node.js backend (`server.js`) to power it
- Pre-styled interface (style.css)
- Submission alert for testing (can be replaced with Airtable POST)

---

## ✅ Requirements

- Node.js: https://nodejs.org/
- An Airtable base called **GIC Logistics** with a table: **Stock In**

### Airtable Fields:
- `Venue`
- `Kit`
- `Component`

Create an API key and base ID at:
https://airtable.com/api  
https://airtable.com/create/tokens

---

## ✅ Setup Instructions

### 1. `.env`

Create a file named `.env` in the project folder:

```
AIRTABLE_API_KEY=your_airtable_token
AIRTABLE_BASE_ID=your_base_id
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the backend

```bash
node server.js
```

Should show: `Server running on port 3000`

---

## ✅ Frontend

Open `index.html` in a browser.

On page load:
- Fetches options from Airtable
- Populates Venue, Reporter, Report Type, Kit, Component, Damage
- Displays selected data on submit

---

## ✅ Next Step

Want to send the submitted data to Airtable?  
Just ask and I’ll help you set up `/submit` in `server.js`.

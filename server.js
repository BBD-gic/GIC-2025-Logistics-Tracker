const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const Airtable = require("airtable");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve static frontend from public/
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Airtable setup
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Stock%20In`;
const headers = { Authorization: `Bearer ${AIRTABLE_API_KEY}` };
const airtableBase = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// ✅ Cache
let allRecords = [];
const recordIdCache = {
  Venue: {},
  Kit: {},
  Part: {},
  Reporter: {},
  Component: {}
};

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

async function fetchAllRecords() {
  const results = [];
  let offset = null;
  try {
    do {
      const params = new URLSearchParams({ view: "Grid view" });
      if (offset) params.append("offset", offset);
      const { data } = await axios.get(`${AIRTABLE_URL}?${params}`, { headers });
      results.push(...data.records);
      offset = data.offset;
    } while (offset);

    allRecords = results.map(r => {
      const f = r.fields;
      const asString = val => Array.isArray(val) ? val.join(", ").trim() : (val || "").trim();
      return {
        ...f,
        "Venue Name": asString(f["Venue Name"]),
        "Kit Name": asString(f["Kit Name"]),
        "Component Name": asString(f["Component Name"]),
        "Damage Types Name": asString(f["Damage Types Name"]),
        "Reporter": asString(f["Reporter"])
      };
    }).filter(r => r["Venue Name"] && r["Kit Name"] && r["Component Name"]);

    console.log(`✅ Total records fetched: ${allRecords.length}`);
  } catch (err) {
    console.error("❌ Airtable fetch error:", err.message);
  }
}

function logSummary(label, records, key) {
  const counts = {};
  const isDamageField = key === "Damage Types Name";
  for (const r of records) {
    const rawVal = r[key];
    if (!rawVal) continue;
    const values = isDamageField
      ? rawVal.split(",").map(s => s.trim()).filter(Boolean)
      : [rawVal.trim()];
    for (const val of values) {
      counts[val] = (counts[val] || 0) + 1;
    }
  }
  return Object.keys(counts);
}

async function cacheRecordIds(tableName, labelField = "Name", cacheKey = tableName) {
  const all = [];
  let offset = null;
  try {
    do {
      const params = new URLSearchParams({ view: "Grid view" });
      if (offset) params.append("offset", offset);
      const { data } = await axios.get(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${params}`,
        { headers }
      );
      all.push(...data.records);
      offset = data.offset;
    } while (offset);

    recordIdCache[cacheKey] = Object.fromEntries(
      all.map(r => [r.fields[labelField]?.trim(), r.id])
    );
  } catch (err) {
    console.error(`❌ Failed to fetch ${tableName}:`, err.message);
  }
}

// 🔄 Routes
app.get("/form-options", async (req, res) => {
  try {
    if (allRecords.length === 0) await fetchAllRecords();
    const { venue, kit } = req.query;

    const filteredForVenue = allRecords;
    const filteredForKits = venue
      ? allRecords.filter(r => normalize(r["Venue Name"]) === normalize(venue))
      : [];
    const filteredForComponents = venue && kit
      ? allRecords.filter(r =>
          normalize(r["Venue Name"]) === normalize(venue) &&
          normalize(r["Kit Name"]) === normalize(kit)
        )
      : [];
    const filteredForDamageTypes = kit
      ? allRecords.filter(r => normalize(r["Kit Name"]) === normalize(kit))
      : [];

    const options = {
      venues: !venue ? logSummary("Venues", filteredForVenue, "Venue Name") : undefined,
      kits: venue && !kit ? logSummary("Kits", filteredForKits, "Kit Name") : undefined,
      components: venue && kit ? logSummary("Components", filteredForComponents, "Component Name") : undefined,
      damageTypes: kit ? logSummary("Damages", filteredForDamageTypes, "Damage Types Name") : undefined
    };

    res.json(options);
  } catch (err) {
    console.error("❌ Form options fetch error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/static-options", async (req, res) => {
  try {
    if (allRecords.length === 0) {
      console.log("🔄 No cached records. Fetching from Airtable...");
      await fetchAllRecords();
    } else {
      console.log("✅ Using cached records");
    }

    const reporterByVenue = {};

    allRecords.forEach(record => {
      const venue = (record["Venue Name"] || "").trim();
      const raw = record.Reporter || "";
      if (!venue) return;
      raw.split(",").map(r => r.trim()).forEach(name => {
        if (!name) return;
        if (!reporterByVenue[venue]) reporterByVenue[venue] = new Set();
        reporterByVenue[venue].add(name);
      });
    });

    Object.keys(reporterByVenue).forEach(venue => {
      reporterByVenue[venue] = Array.from(reporterByVenue[venue]);
    });

    console.log("✅ Returning static options");
    res.json({
      reportTypes: ["Report Missing", "Report Damage", "Issue Product"],
      reporters: reporterByVenue
    });
  } catch (err) {
    console.error("❌ Static options error:", err.message);
    res.status(500).json({ error: "Static options error" });
  }
});


app.post("/submit", async (req, res) => {
  try {
    const { reporter, reportType, venue, kit, component, damageType, count } = req.body;

    console.log("📥 Incoming body from frontend:", JSON.stringify(req.body, null, 2));

    if (!reporter || !reportType || !venue || !kit || !component || !count) {
      console.warn("⚠️ Missing fields in submission");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const record = {
      "Reporter": recordIdCache.Reporter[reporter] ? [recordIdCache.Reporter[reporter]] : [reporter],
      "Report Type": [reportType],
      "Venue": recordIdCache.Venue[venue] ? [recordIdCache.Venue[venue]] : [venue],
      "Kit": recordIdCache.Kit[kit] ? [recordIdCache.Kit[kit]] : [kit],
      "Component": recordIdCache.Component[component] ? [recordIdCache.Component[component]] : [component],
      ...(reportType === "Report Damage" && damageType && {
        "Type of Damage": Array.isArray(damageType)
          ? damageType.map(d => d.trim())
          : [damageType.trim()]
      }),
      "QTY": parseInt(count)
    };

    console.log("📤 Record being sent to Airtable:", JSON.stringify(record, null, 2));

    airtableBase("Damages").create([{ fields: record }], (err, records) => {
      if (err) {
        console.error("❌ Airtable error:", err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log("✅ Airtable submission success. Record ID:", records[0].id);
      res.json({ success: true, id: records[0].id });
    });
  } catch (err) {
    console.error("❌ Server error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});


// ✅ Start
app.listen(process.env.PORT || 3000, async () => {
  console.log("🚀 Server running...");
  await fetchAllRecords();
  await cacheRecordIds("Venues", "Name", "Venue");
  await cacheRecordIds("Kits", "Name", "Kit");
  await cacheRecordIds("Stock In", "Component Name", "Component");
  await cacheRecordIds("Program Mgmt Team", "Name", "Reporter");
});

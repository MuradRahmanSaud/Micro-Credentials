import express from "express";
import path from "path";
import axios from "axios";
import { parse } from "csv-parse/sync";
import multer from "multer";
import fs from "fs";
import os from "os";

const app = express();
app.use(express.json());

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_iQK4Z5C1ppjPA3g3JbHU4kbXLMS0aWhWg73mwRFY8QUohd_u8MuvusHK5ZxOXSDx/exec";
const SPREADSHEET_ID = "1zpDWjuTLdSIdZ8GCICEo6EFs962kAkBk1TpIPDvmZwc";
const GID = "0";
const SETTINGS_GID = "1972051572";
const DRIVE_FOLDER_ID = ""; // Left empty to save in the Root Folder of Google Drive by default

// Simple in-memory cache mapped by spreadsheetId_GID (Note: Serverless functions are ephemeral, so cache might reset frequently, which is fine)
const dynamicCache = new Map<string, { data: any; lastUpdate: number }>();
const CACHE_TTL = 600000; // 10 minutes

async function refreshDynamicCache(gid: string, spreadsheetIdOverride?: string, retries = 3) {
  const spreadsheetId = spreadsheetIdOverride || SPREADSHEET_ID;
  const cacheKey = `${spreadsheetId}_${gid}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      const csvResponse = await axios.get(csvUrl, { timeout: 15000 }); // Increased timeout
      
      const records = parse(csvResponse.data, {
        columns: true,
        skip_empty_lines: true,
        trim: false
      });
      
      dynamicCache.set(cacheKey, {
        data: records,
        lastUpdate: Date.now()
      });
      return records;
    } catch (error: any) {
      console.warn(`Attempt ${i + 1} failed for spreadsheet ${spreadsheetId} GID ${gid}: ${error.message}`);
      if (i === retries - 1) {
        console.error(`All attempts failed for spreadsheet ${spreadsheetId} GID ${gid}:`, error.message);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
    }
  }
}

async function handleProxy(req: express.Request, res: express.Response) {
  try {
    const gid = String(req.body.gid || req.query.gid || GID);
    
    const customSpreadsheetId = req.headers["x-spreadsheet-id"] as string;
    const customAppsScriptUrl = req.headers["x-apps-script-url"] as string;
    
    const spreadsheetId = customSpreadsheetId || SPREADSHEET_ID;
    const appsScriptUrl = customAppsScriptUrl || APPS_SCRIPT_URL;

    const payload = {
      ...req.body,
      spreadsheetId: spreadsheetId,
      gid: gid
    };

    const response = await axios.post(appsScriptUrl, payload, {
      headers: { "Content-Type": "application/json" },
      maxRedirects: 10,
      validateStatus: (status) => status < 400
    });

    // Invalidate cache on mutations
    if (payload.action !== "GET") {
      dynamicCache.delete(`${spreadsheetId}_${gid}`);
    }

    res.json(response.data);
  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    res.status(500).json({ 
      error: "Failed to communicate with Google Apps Script",
      details: error.message 
    });
  }
}

// Reusable API to handle all sheet operations for ANY GID
app.post("/api/proxy", handleProxy);

app.post("/api/settings-proxy", async (req, res) => {
  // Backwards compatibility mapped to the dynamic proxy
  req.body.gid = SETTINGS_GID;
  return handleProxy(req, res);
});

async function handleData(req: express.Request, res: express.Response) {
  const gid = String(req.query.gid || GID);
  const force = req.query.force === "true";
  const now = Date.now();
  
  const customSpreadsheetId = req.headers["x-spreadsheet-id"] as string;
  const spreadsheetId = customSpreadsheetId || SPREADSHEET_ID;
  const cacheKey = `${spreadsheetId}_${gid}`;
  
  const cacheEntry = dynamicCache.get(cacheKey);
  
  if (!force && cacheEntry && (now - cacheEntry.lastUpdate < CACHE_TTL)) {
    return res.json(cacheEntry.data);
  }

  try {
    const data = await refreshDynamicCache(gid, spreadsheetId);
    res.json(data);
  } catch (error: any) {
    if (cacheEntry) return res.json(cacheEntry.data); // Return stale cache on error
    res.status(500).json({ error: `Failed to fetch data for GID ${gid}`, details: error.message });
  }
}

// Reusable and optimized data fetch with caching for ANY GID
app.get("/api/data", handleData);

app.get("/api/settings-data", async (req, res) => {
  // Backwards compatibility mapped to the dynamic query
  req.query.gid = SETTINGS_GID;
  return handleData(req, res);
});


// Determine dynamic temp upload directory for serverless (Vercel) / container support
const UPLOADS_DIR = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Endpoint to upload profile photo (attempts Google Drive upload via Apps Script with local fallback)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const localUrl = `/uploads/${req.file.filename}`;

  try {
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const base64Data = fileBuffer.toString("base64");

    let filename = req.file.originalname;
    if (req.body.departmentName) {
      const ext = path.extname(req.file.originalname) || ".png";
      const sanitisedDept = req.body.departmentName
        .replace(/[/\\?%*:|"<>]/g, "-")
        .trim();
      filename = sanitisedDept ? `${sanitisedDept}${ext}` : filename;
    }

    const customSpreadsheetId = req.headers["x-spreadsheet-id"] as string;
    const customAppsScriptUrl = req.headers["x-apps-script-url"] as string;
    const customDriveFolderId = req.headers["x-drive-folder-id"] as string;
    const spreadsheetId = customSpreadsheetId || SPREADSHEET_ID;
    const appsScriptUrl = customAppsScriptUrl || APPS_SCRIPT_URL;
    const driveFolderId = customDriveFolderId || DRIVE_FOLDER_ID;

    if (appsScriptUrl) {
      try {
        const response = await axios.post(appsScriptUrl, {
          action: "UPLOAD_FILE",
          spreadsheetId: spreadsheetId,
          gid: GID,
          folderId: driveFolderId,
          folderPath: req.body.folderPath,
          filename: filename,
          mimeType: req.file.mimetype,
          base64Data: base64Data
        }, {
          headers: { "Content-Type": "application/json" },
          maxRedirects: 10,
          timeout: 20000
        });

        if (response.data && response.data.success && (response.data.url || response.data.fileLink)) {
          const driveUrl = response.data.url || response.data.fileLink;
          try {
            await fs.promises.unlink(req.file.path);
          } catch (e) {}
          return res.json({ url: driveUrl, fileLink: driveUrl });
        } else {
          console.warn("Apps Script upload returned no URL/error, falling back to local file:", response.data);
        }
      } catch (scriptErr: any) {
        console.warn("Apps Script upload failed, falling back to local file:", scriptErr.message);
      }
    }

    // Local fallback if Google Drive upload is unavailable or fails
    return res.json({ url: localUrl, fileLink: localUrl });
  } catch (error: any) {
    console.error("Upload processing error, falling back to local file:", error.message);
    return res.json({ url: localUrl, fileLink: localUrl });
  }
});

// Endpoint to delete profile photo
app.post("/api/delete-file", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.json({ success: false });
  }

  if (url.startsWith("/uploads/")) {
    const filename = url.replace("/uploads/", "");
    const filepath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
        return res.json({ success: true });
      } catch (e: any) {
        console.error("Failed to delete local file:", e.message);
      }
    }
  }

  if (url.includes("drive.google.com")) {
    try {
      const urlObj = new URL(url);
      const fileId = urlObj.searchParams.get("id");
      if (fileId) {
        const customSpreadsheetId = req.headers["x-spreadsheet-id"] as string;
        const customAppsScriptUrl = req.headers["x-apps-script-url"] as string;
        const spreadsheetId = customSpreadsheetId || SPREADSHEET_ID;
        const appsScriptUrl = customAppsScriptUrl || APPS_SCRIPT_URL;

        const response = await axios.post(appsScriptUrl, {
          action: "DELETE_FILE",
          spreadsheetId: spreadsheetId,
          gid: GID,
          fileId: fileId
        }, {
          headers: { "Content-Type": "application/json" },
          maxRedirects: 10,
          timeout: 10000
        });
        if (response.data && response.data.success) {
          return res.json({ success: true });
        }
      }
    } catch (e: any) {
      console.error("Failed to delete file from Google Drive via Apps Script:", e.message);
    }
  }

  res.json({ success: false });
});

// Proxy endpoint to bypass CORS/CORP for Google Drive images
app.get("/api/image", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).send("No URL provided");
  }
  
  try {
    const response = await axios.get(url, { 
      responseType: "stream",
      maxRedirects: 10
    });
    
    if (response.headers["content-type"]) {
      res.set("Content-Type", String(response.headers["content-type"]));
    }
    
    res.set("Cache-Control", "public, max-age=86400");
    response.data.pipe(res);
  } catch (error: any) {
    console.error("Image proxy error:", error.message);
    res.status(500).send("Failed to fetch image");
  }
});

// Serve uploads statically
app.use("/uploads", express.static(UPLOADS_DIR));

export default app;


const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
if (!fs.existsSync("uploads/homepage")) {
  fs.mkdirSync("uploads/homepage", { recursive: true });
}


console.log("🔥 THIS SERVER.JS FILE IS RUNNING 🔥");

const multer = require("multer");
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const session = require("express-session");

const app = express();
let submissions = [];

const DATA_FILE = path.join(__dirname, "submissions.json");

if (fs.existsSync(DATA_FILE)) {
  submissions = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

const TEXT_DATA = path.join(__dirname, "homepage-text.json");

if (!fs.existsSync(TEXT_DATA)) {
  fs.writeFileSync(TEXT_DATA, JSON.stringify({}, null, 2));
}



const PORT = process.env.PORT || 5000;




// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "beastfit_secret_key",
    resave: false,
    saveUninitialized: false
  })
);

// ================= ADMIN CREDENTIALS =================
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "12345"; // change later

// ================= IMAGE STORAGE =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/homepage");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });


// SAVE TEXT API


app.post("/admin/save-text", checkAuth, (req, res) => {
  const existing = JSON.parse(fs.readFileSync(TEXT_DATA, "utf8"));

  const updated = {
    ...existing,     // ✅ keep old text
    ...req.body     // ✅ overwrite only changed text
  };

  fs.writeFileSync(TEXT_DATA, JSON.stringify(updated, null, 2));

  res.json({ success: true });
});

// API TO READ TEXT

app.get("/homepage-text", (req, res) => {
  const data = JSON.parse(fs.readFileSync(TEXT_DATA, "utf8"));
  res.json(data);
});



// ================= FORM SUBMISSION =================
app.post("/contact", (req, res) => {
  const entry = {
    fullName: req.body.fullName,
    phone: req.body.phone,
    plan: req.body.plan,
    goal: req.body.goal,
    date: new Date().toLocaleString()
  };

  submissions.push(entry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));

  // ✅ IMPORTANT CHANGE
  res.status(200).json({ success: true });
});


// ================= ADMIN LOGIN =================
app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  } else {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password"
    });
  }
});


// ================= AUTH MIDDLEWARE =================
function checkAuth(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect("/adminlogin.html");
  }
}

// ================= IMAGE UPLOAD (ADMIN ONLY) =================
const IMAGE_DATA = path.join(__dirname, "homepage-images.json");

if (!fs.existsSync(IMAGE_DATA)) {
  fs.writeFileSync(
    IMAGE_DATA,
    JSON.stringify(
      {
        athlete: "",
        img1: "",
        img2: "",
        img3: ""
      },
      null,
      2
    )
  );
}

app.post("/admin/upload-image", checkAuth, upload.single("image"), (req, res) => {
  const images = JSON.parse(fs.readFileSync(IMAGE_DATA));
  const { type } = req.body;

  images[type] = `/uploads/homepage/${req.file.filename}`;

  fs.writeFileSync(IMAGE_DATA, JSON.stringify(images, null, 2));

  res.json({ success: true });
});

// ================= HOMEPAGE IMAGES =================
app.get("/homepage-images", (req, res) => {
  const data = JSON.parse(fs.readFileSync(IMAGE_DATA));
  res.json(data);
});



// ================= ADMIN DATA (PROTECTED) =================
app.get("/admin/data", checkAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json(data);
});

// ================= ADMIN PAGE (PROTECTED) =================
app.get("/adminlogin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminlogin.html"));
});

app.get("/admin.html", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});


// ================= LOGOUT =================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/adminlogin.html");
  });
});


// ===== EXPORT FORM SUBMISSIONS TO EXCEL =====
const XLSX = require("xlsx");

app.get("/admin/export-excel", checkAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));



  if (!data || data.length === 0) {
    return res.status(400).send("No data to export");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Form Submissions");

  const filePath = path.join(__dirname, "BeastFit_Form_Submissions.xlsx");

  XLSX.writeFile(workbook, filePath);

  res.download(filePath, "BeastFit_Form_Submissions.xlsx", err => {
    if (!err && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // cleanup
    }
  });
});


// ================= STATIC FILES =================
app.use(express.static("public"));




app.use("/uploads", express.static(path.join(__dirname, "uploads")));




// Delete selected records

app.post("/admin/delete-selected", checkAuth, (req, res) => {
  const indexes = req.body.indexes;

  submissions = submissions.filter((_, i) => !indexes.includes(i));

  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
  res.json({ success: true });
});


// Delete all records
 
app.post("/admin/delete-all", checkAuth, (req, res) => {
  submissions = [];
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
  res.json({ success: true });
});



//PRICE APIs

const PRICE_FILE = path.join(__dirname, "prices.json");

if (!fs.existsSync(PRICE_FILE)) {
  fs.writeFileSync(
    PRICE_FILE,
    JSON.stringify(
      {
        monthly: "1500",
        quarterly: "4000",
        yearly: "12000"
      },
      null,
      2
    )
  );
}

// Get prices (homepage)
app.get("/homepage-prices", (req, res) => {
  const prices = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));
  res.json(prices);
});

// Save prices (admin)
app.post("/admin/save-prices", checkAuth, (req, res) => {
  const existing = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));

  const updated = {
    ...existing,
    ...req.body
  };

  fs.writeFileSync(PRICE_FILE, JSON.stringify(updated, null, 2));
  res.json({ success: true });
});


app.get("/test-route", (req, res) => {
  res.send("TEST ROUTE WORKS");
});


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});



app.listen(PORT, () => console.log("Server running"));




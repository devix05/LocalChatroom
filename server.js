const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const socketIO = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const session = require("express-session");
const MongoStore = require("connect-mongo");

dotenv.config();

const app = express();
const server = require("http").createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/chatroom",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: false,
    },
  }),
);

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/chatroom")
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch((err) => console.error("❌ MongoDB Fehler:", err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: "/default-avatar.png" },
  createdAt: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  sender: String,
  senderId: mongoose.Schema.Types.ObjectId,
  content: String,
  fileUrl: String,
  fileType: { type: String, enum: ["image", "video", "text"], default: "text" },
  timestamp: { type: Date, default: Date.now },
  profileImage: String,
});

const Message = mongoose.model("Message", messageSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Nur Bilder und Videos erlaubt"), false);
    }
  },
});

const authenticateToken = (req, res, next) => {
  const token = req.session.token;
  if (!token) return res.status(401).json({ error: "Nicht authentifiziert" });

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback-secret",
    (err, user) => {
      if (err) return res.status(403).json({ error: "Token ungültig" });
      req.user = user;
      next();
    },
  );
};

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Benutzername und Passwort erforderlich" });
    }

    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Benutzername muss mindestens 3 Zeichen haben" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Passwort muss mindestens 6 Zeichen haben" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Benutzername bereits vergeben" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword,
      profileImage: "/default-avatar.png",
    });

    await user.save();

    console.log(
      "✅ Neuer Benutzer registriert:",
      username,
      "mit Standard-Profilbild",
    );
    res.json({ message: "Registrierung erfolgreich" });
  } catch (error) {
    console.error("❌ Registrierungsfehler:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "24h" },
    );

    req.session.token = token;
    user.isOnline = true;
    await user.save();

    res.json({
      user: {
        id: user._id,
        username: user.username,
        profileImage: user.profileImage || "/default-avatar.png",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/logout", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isOnline: false });
    req.session.destroy();
    res.json({ message: "Logout erfolgreich" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/upload-profile",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Keine Datei" });
      }

      const imageUrl = "/uploads/" + req.file.filename;

      await User.findByIdAndUpdate(req.user.id, { profileImage: imageUrl });

      console.log(
        "✅ Profilbild aktualisiert für:",
        req.user.username,
        "-",
        imageUrl,
      );
      res.json({ imageUrl });
    } catch (error) {
      console.error("❌ Upload-Fehler:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

app.post(
  "/api/upload-file",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Keine Datei" });
      }

      const fileType = req.file.mimetype.startsWith("video/")
        ? "video"
        : "image";
      res.json({
        fileUrl: "/uploads/" + req.file.filename,
        fileType: fileType,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get("/api/messages", authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 }).limit(100);
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select(
      "username profileImage isOnline lastSeen",
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket verbunden:", socket.id);

  socket.on("user-joined", async (user) => {
    const userData = await User.findById(user.id).select(
      "username profileImage isOnline",
    );
    if (userData) {
      connectedUsers.set(socket.id, {
        id: userData._id,
        username: userData.username,
        profileImage: userData.profileImage || "/default-avatar.png",
      });

      await User.findByIdAndUpdate(userData._id, { isOnline: true });

      const allUsers = await User.find().select(
        "username profileImage isOnline",
      );
      io.emit("user-list", allUsers);
      io.emit("system-message", {
        content: `${userData.username} ist dem Chat beigetreten`,
        timestamp: new Date(),
      });
    }
  });

  socket.on("send-message", async (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const userData = await User.findById(user.id).select("profileImage");

      const messageData = {
        sender: user.username,
        senderId: user.id,
        content: data.content || "",
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || "text",
        timestamp: new Date(),
        profileImage: userData?.profileImage || "/default-avatar.png",
      };

      const newMessage = new Message(messageData);
      await newMessage.save();
      io.emit("new-message", messageData);
    }
  });

  socket.on("typing", (isTyping) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit("user-typing", {
        username: user.username,
        isTyping: isTyping,
      });
    }
  });

  socket.on("disconnect", async () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      await User.findByIdAndUpdate(user.id, { isOnline: false });
      connectedUsers.delete(socket.id);

      const allUsers = await User.find().select(
        "username profileImage isOnline",
      );
      io.emit("user-list", allUsers);
      io.emit("system-message", {
        content: `${user.username} hat den Chat verlassen`,
        timestamp: new Date(),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server läuft auf http://localhost:${PORT}\n`);
});

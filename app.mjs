import 'dotenv/config'
import { connectDB, getDB } from './db/mongo.mjs'
import express from 'express'
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';

const app = express()
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GRID_DAYS = ["Mon","Tue","Wed","Thu","Fri"];
const GRID_TIMES = ["9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM"];

const labelToMinutes = (label) => {
  const [t, ap] = label.split(" ");
  let [h, m] = t.split(":").map(Number);
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h*60 + m;
};
const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h*60 + m;
};

app.use(express.static(join(__dirname, 'public')));
app.use('/scripts', express.static(join(__dirname, 'scripts')));
app.use("/styles", express.static("styles"));
app.use(express.json());

// Call function from db/mongo.mjs
connectDB()

// ROUTES
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/professors', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'professors.html'));
});

// get professor's schedule by professor id
app.get("/api/professors/:id/schedule", async (req, res) => {
  try {
    const db = getDB();
    const _id = new ObjectId(req.params.id);
    const prof = await db.collection("Professors").findOne(
      { _id },
      { projection: { officeHoursTemplate: 1 } }
    );
    if (!prof) return res.status(404).json({ error: "Professor not found" });

    const tmpl = prof.officeHoursTemplate || {};
    const slots = [];

    // precompute label to minutes map
    const labelMinutes = Object.fromEntries(GRID_TIMES.map(l => [l, labelToMinutes(l)]));

    for (const day of GRID_DAYS) {
      const ranges = (tmpl[day] || []).map(([a,b]) => [timeToMinutes(a), timeToMinutes(b)]);
      for (const label of GRID_TIMES) {
        const startMin = labelMinutes[label];
        const inRange = ranges.some(([s,e]) => startMin >= s && startMin < e);
        slots.push({ day, time: label, status: inRange ? "available" : "booked" });
      }
    }

    res.json({ professorId: _id, slots });
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

app.get('/schedule', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'schedule.html'));
});

// read professors
app.get('/api/professors', async (_req, res) => {
  try {
    const db = getDB();
    const profs = await db.collection('Professors').find({}).toArray();
    res.json(profs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch professors: ' + e.message });
  }
});

// get one professor by id
app.get("/api/professors/:id", async (req, res) => {
  try {
    const db = getDB();
    const _id = new ObjectId(req.params.id);
    const prof = await db.collection("Professors").findOne(
      { _id },
      { projection: { name: 1, department: 1, office: 1, email: 1, officeHoursTemplate: 1, timezone: 1 } }
    );
    if (!prof) return res.status(404).json({ error: "Professor not found" });
    res.json(prof);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// Login API endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDB();
    
    // Find user in database
    const user = await db.collection('users').findOne({ username: username });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Compare password with hashed password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Successful login
    console.log('User logged in:', username);
    res.json({ 
      success: true, 
      redirectTo: '/professors',
      user: { 
        username: user.username, 
        id: user._id 
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login. Please try again.' });
  }
});

// Register API endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDB();
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ username: username });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      username: username,
      password: hashedPassword,
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    console.log('New user registered:', username);
    res.status(201).json({ 
      success: true, 
      message: 'Registration successful',
      redirectTo: '/login.html'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
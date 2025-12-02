import 'dotenv/config'
import { connectDB, getDB } from './db/mongo.mjs'
import express from 'express'
import multer from 'multer'
import fs from 'fs/promises'
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import { sendEmail } from './mailer.mjs'

const app = express()
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GRID_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const GRID_TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

const labelToMinutes = (label) => {
  const [t, ap] = label.split(" ");
  let [h, m] = t.split(":").map(Number);
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + m;
};
const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
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

    // Helper to convert HH:MM to minutes
    const timeToMinutes = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };

    // Helper to convert minutes to HH:MM AM/PM format
    // Lowkey messy but semi works
    const minutesToLabel = (minutes) => {
      let h = Math.floor(minutes / 60);
      const m = minutes % 60;
      let ap = "AM";

      if (h >= 12) {
        ap = "PM";
        if (h > 12) h -= 12;
      } else if (h === 0) {
        h = 12;
      }

      const mStr = m === 0 ? "00" : m;
      return `${h}:${mStr} ${ap}`;
    };

    // Generate a slot(s) for each day
    for (const day of GRID_DAYS) {
      const ranges = tmpl[day] || [];
      if (ranges.length > 0) {
        ranges.forEach(([startTime, endTime]) => {
          const startMin = timeToMinutes(startTime);
          const endMin = timeToMinutes(endTime);

          // Generate slots at 15-minute intervals
          // instead of just the whole hour blocks
          for (let currentMin = startMin; currentMin < endMin; currentMin += 15) {
            const slotStart = minutesToLabel(currentMin);
            const slotEnd = minutesToLabel(currentMin + 15);

            slots.push({
              day,
              startTime: slotStart,
              endTime: slotEnd,
              status: "available"
            });
          }
        });
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

// Upload professor avatar (multipart/form-data, field name: `avatar`)
// Saves file to `public/images/professors/<profId>.<ext>` and updates professor doc
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

app.post('/api/professors/:id/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid professor id' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Determine extension
    const mime = req.file.mimetype || '';
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';

    const destDir = join(__dirname, 'public', 'images', 'professors');
    await fs.mkdir(destDir, { recursive: true });
    const filename = `${id}.${ext}`;
    const destPath = join(destDir, filename);

    // Write buffer to disk
    await fs.writeFile(destPath, req.file.buffer);

    const avatarUrl = `/images/professors/${filename}`;
    await db.collection('Professors').updateOne(
      { _id: new ObjectId(id) },
      { $set: { avatarUrl } }
    );

    res.json({ success: true, avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
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
      { projection: { name: 1, department: 1, office: 1, email: 1, officeHoursTemplate: 1, timezone: 1, avatarUrl: 1 } }
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

// Get all bookings for a professor
app.get('/api/professors/:professorId/bookings', async (req, res) => {
  try {
    const db = getDB();
    const professorId = new ObjectId(req.params.professorId);

    // Get professor's office hours template
    const prof = await db.collection('Professors').findOne(
      { _id: professorId },
      { projection: { officeHoursTemplate: 1 } }
    );

    if (!prof) {
      return res.status(404).json({ error: 'Professor not found' });
    }

    const bookings = await db.collection('Bookings').find({
      professorId: professorId.toString()
    }).toArray();

    res.json({
      professorId: professorId.toString(),
      officeHoursTemplate: prof.officeHoursTemplate,
      bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Create a new booking
app.post('/api/professors/:professorId/bookings', async (req, res) => {
  try {
    const db = getDB();
    const { day, startTime, endTime, studentId, studentName, studentEmail } = req.body;
    const professorId = new ObjectId(req.params.professorId);

    // Validate input
    if (!day || !startTime || !endTime) {
      return res.status(400).json({ error: 'Day, startTime, and endTime are required' });
    }

    // Helper to convert HH:MM AM/PM to minutes
    // Again, messy but works
    const timeToMinutes = (timeStr) => {
      // Handle both "10:45 AM" and "10:45" formats
      const parts = timeStr.trim().split(' ');
      const timePart = parts[0];
      const ap = parts[1];

      const [h, m] = timePart.split(':').map(Number);
      let hours = h;

      if (ap === 'PM' && h !== 12) {
        hours = h + 12;
      } else if (ap === 'AM' && h === 12) {
        hours = 0;
      }

      return hours * 60 + m;
    };

    // Get professor and validate office hours
    const prof = await db.collection('Professors').findOne({ _id: professorId });
    if (!prof || !prof.officeHoursTemplate) {
      return res.status(404).json({ error: 'Professor not found' });
    }

    // Validate that the requested time falls within office hours
    const officeHours = prof.officeHoursTemplate[day];
    if (!officeHours || officeHours.length === 0) {
      return res.status(400).json({ error: `Professor has no office hours on ${day}` });
    }

    const reqStartMin = timeToMinutes(startTime);
    const reqEndMin = timeToMinutes(endTime);

    // Check if requested time is within any office hour range
    const validTime = officeHours.some(([start, end]) => {
      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      return reqStartMin >= startMin && reqEndMin <= endMin;
    });

    if (!validTime) {
      return res.status(400).json({ error: 'Requested time is not within professor office hours' });
    }

    // Check if slot is already booked
    const existingBooking = await db.collection('Bookings').findOne({
      professorId: professorId.toString(),
      day,
      startTime,
      endTime
    });

    if (existingBooking) {
      return res.status(409).json({ error: 'Time slot already booked' });
    }

    // Create booking
    const booking = {
      professorId: professorId.toString(),
      day,
      startTime,
      endTime,
      studentId: studentId || null,
      studentName: studentName || 'Anonymous',
      studentEmail: studentEmail || null,
      createdAt: new Date(),
      status: 'confirmed'
    };

    if (prof.email) {
      await sendEmail(
        prof.email,
        `New Appointment Booked: ${day} ${startTime}-${endTime}`,
        `Hi ${prof.name || 'Professor'},\n\n` +
        `A student has booked an appointment.\n\n` +
        `Student: ${studentName || 'Anonymous'}\n` +
        `Email: ${studentEmail || 'N/A'}\n` +
        `Day: ${day}\n` +
        `Time: ${startTime} - ${endTime}\n\n` +
        `This message was generated automatically.`
      );
    }

  const result = await db.collection('Bookings').insertOne(booking);

  res.status(201).json({
    success: true,
    bookingId: result.insertedId,
    message: 'Booking confirmed',
    booking
  });

} catch (error) {
  console.error('Error creating booking:', error);
  res.status(500).json({ error: 'Failed to create booking' });
}
});

// Delete a booking
app.delete('/api/bookings/:bookingId', async (req, res) => {
  try {
    const db = getDB();
    const bookingId = new ObjectId(req.params.bookingId);

    const result = await db.collection('Bookings').deleteOne({ _id: bookingId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Update a booking
app.put('/api/bookings/:bookingId', async (req, res) => {
  try {
    const db = getDB();
    const bookingId = new ObjectId(req.params.bookingId);
    const { day, startTime, endTime, studentName, studentEmail } = req.body;

    const updateData = {};
    if (day) updateData.day = day;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (studentName) updateData.studentName = studentName;
    if (studentEmail) updateData.studentEmail = studentEmail;
    updateData.updatedAt = new Date();

    const result = await db.collection('Bookings').updateOne(
      { _id: bookingId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, message: 'Booking updated' });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
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

app.use(express.static(join(__dirname, 'public')));
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

app.get('/schedule', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'schedule.html'));
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
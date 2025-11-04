//import 'dotenv/config'
//import { connectDB, getDB } from './db/mongo.mjs'
import express from 'express'
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
//import { ObjectId } from 'mongodb';

const app = express()
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(join(__dirname, 'public')));
//app.use('/scripts', express.static(join(__dirname, 'scripts')));
app.use(express.json());

// Call function from db/mongo.mjs
//connectDB()

// ROUTES
app.get('/', (req, res) => {
  res.redirect('/professors');
});

app.get('/professors', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'professors.html'));
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})

import 'dotenv/config'
import { connectDB, getDB } from '../db/mongo.mjs'
import fs from 'fs/promises'
import path from 'path'
import { ObjectId } from 'mongodb'

// Usage: node scripts/set-avatar.js <profId> <localImagePath>
// Copies the provided image into public/images/professors/<profId>.<ext>
// and sets professor.avatarUrl to `/images/professors/<profId>.<ext>`

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/set-avatar.js <profId> <localImagePath>');
    process.exit(1);
  }

  const [profId, imagePath] = args;
  if (!ObjectId.isValid(profId)) {
    console.error('Invalid ObjectId:', profId);
    process.exit(1);
  }

  await connectDB();
  const db = getDB();

  try {
    // Resolve and normalize the provided image path so Windows paths
    // like "C:\Users\..." are handled correctly regardless of shell.
    const srcPath = path.resolve(imagePath);
    const stat = await fs.stat(srcPath).catch(() => null);
    if (!stat || !stat.isFile()) throw new Error(`Image not found: ${srcPath}`);

    const ext = path.extname(srcPath).replace('.', '').toLowerCase() || 'jpg';
    const destDir = path.join(process.cwd(), 'public', 'images', 'professors');
    await fs.mkdir(destDir, { recursive: true });
    const destName = `${profId}.${ext}`;
    const destPath = path.join(destDir, destName);

    await fs.copyFile(srcPath, destPath);

    const avatarUrl = `/images/professors/${destName}`;
    const result = await db.collection('Professors').updateOne(
      { _id: new ObjectId(profId) },
      { $set: { avatarUrl } }
    );

    if (result.matchedCount === 0) {
      console.error('No professor found with id', profId);
      process.exit(2);
    }

    console.log('Avatar set for', profId, '->', avatarUrl);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();

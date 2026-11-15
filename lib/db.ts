//lib/db.ts
import mongoose from 'mongoose';

/*
    MongoDB Connection Manager

    Why this exists:

    Next.js uses hot reload during development.

    Without caching:
    - Every API request creates a new connection
    - MongoDB connection limit can be reached

    This file creates one reusable connection.
*/
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI in environment variables');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = {
    conn: null,
    promise: null,
  };
}

export async function connectDB() {
  try {
    // If database already connected
    // return existing connection
    if (cached.conn) {
      return cached.conn;
    }

    // Create new connection
    if (!cached.promise) {
      cached.promise = mongoose.connect(MONGODB_URI!, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        maxPoolSize: 10,
        minPoolSize: 2,
        family: 4, // Force IPv4
      });
    }

    cached.conn = await cached.promise;

    console.log('MongoDB Connected');
    return cached.conn;
  } catch (error) {
    console.log('MongoDB Connection Failed', error);

    // Reset promise on failure to allow retry
    cached.promise = null;
    throw error;
  }
}

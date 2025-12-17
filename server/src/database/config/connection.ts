import mongoose from 'mongoose';
import { getDatabaseConfig } from './database';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  if (isConnected) {
    console.log('📊 MongoDB: Already connected to database');
    return;
  }

  try {
    const config = getDatabaseConfig();
    
    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 Database URI: ${config.uri.replace(/\/\/.*@/, '//***:***@')}`);
    console.log(`⚙️  Connection pool: ${config.options.minPoolSize}-${config.options.maxPoolSize} connections`);

    await mongoose.connect(config.uri, config.options);
    
    isConnected = true;
    
    console.log('✅ MongoDB: Successfully connected to database');
    console.log(`🗄️  Database name: ${mongoose.connection.name}`);
    console.log(`📊 Connection state: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // Log connection events
    mongoose.connection.on('connected', () => {
      console.log('📡 MongoDB: Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB: Connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB: Disconnected from MongoDB');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB: Reconnected to MongoDB');
      isConnected = true;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await disconnectDB();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await disconnectDB();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB: Failed to connect to database');
    console.error('💥 Error details:', error);
    isConnected = false;
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) {
    console.log('📊 MongoDB: Already disconnected');
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('👋 MongoDB: Successfully disconnected from database');
  } catch (error) {
    console.error('❌ MongoDB: Error during disconnection:', error);
    throw error;
  }
};

export const getConnectionState = (): {
  readyState: number;
  host: string;
  port: number;
  name: string;
} => {
  return {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

export default mongoose;
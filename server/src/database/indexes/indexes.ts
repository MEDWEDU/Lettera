import { User } from '../models/User';
import { Chat } from '../models/Chat';
import { Message } from '../models/Message';
import { FeedbackRequest } from '../models/FeedbackRequest';
import { SearchHistory } from '../models/SearchHistory';
import { OnlineStatus } from '../models/OnlineStatus';

/**
 * Функция для создания всех необходимых индексов в базе данных
 * Вызывается после успешного подключения к MongoDB
 */
export const createIndexes = async (): Promise<void> => {
  try {
    console.log('🔍 Starting to create database indexes...');

    // Создаем индексы для коллекции users
    console.log('📊 Creating indexes for users collection...');
    
    const userIndexes = await User.syncIndexes();
    console.log(`✅ Users indexes synced: ${Object.keys(userIndexes).length} indexes`);

    // Создаем индексы для коллекции chats
    console.log('💬 Creating indexes for chats collection...');
    
    const chatIndexes = await Chat.syncIndexes();
    console.log(`✅ Chats indexes synced: ${Object.keys(chatIndexes).length} indexes`);

    // Создаем индексы для коллекции messages
    console.log('📝 Creating indexes for messages collection...');
    
    const messageIndexes = await Message.syncIndexes();
    console.log(`✅ Messages indexes synced: ${Object.keys(messageIndexes).length} indexes`);

    // Создаем индексы для коллекции feedbackRequests
    console.log('📋 Creating indexes for feedbackRequests collection...');
    
    const feedbackRequestIndexes = await FeedbackRequest.syncIndexes();
    console.log(`✅ FeedbackRequests indexes synced: ${Object.keys(feedbackRequestIndexes).length} indexes`);

    // Создаем индексы для коллекции searchHistory
    console.log('🔍 Creating indexes for searchHistory collection...');
    
    const searchHistoryIndexes = await SearchHistory.syncIndexes();
    console.log(`✅ SearchHistory indexes synced: ${Object.keys(searchHistoryIndexes).length} indexes`);

    // Создаем индексы для коллекции onlineStatus
    console.log('🟢 Creating indexes for onlineStatus collection...');
    
    const onlineStatusIndexes = await OnlineStatus.syncIndexes();
    console.log(`✅ OnlineStatus indexes synced: ${Object.keys(onlineStatusIndexes).length} indexes`);

    // Создаем дополнительные специфические индексы
    await createAdditionalIndexes();

    console.log('🎉 All database indexes created successfully!');

  } catch (error: unknown) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
};

/**
 * Создание дополнительных индексов, которые не могут быть определены в схемах Mongoose
 */
const createAdditionalIndexes = async (): Promise<void> => {
  try {
    console.log('⚙️  Creating additional custom indexes...');

    // Дополнительный индекс для быстрого поиска пользователей по категории и статусу
    await User.collection.createIndex(
      { 'profile.category': 1, status: 1, lastSeen: -1 },
      { name: 'user_category_status_lastseen' }
    );
    console.log('  ✅ User category+status+lastSeen index created');

    // Дополнительный индекс для поиска по навыкам
    await User.collection.createIndex(
      { 'profile.skills': 1 },
      { name: 'user_skills_single' }
    );
    console.log('  ✅ User skills single index created');

    // Дополнительный составной индекс для сообщений
    await Message.collection.createIndex(
      { chatId: 1, senderId: 1, timestamp: -1 },
      { name: 'message_chat_sender_timestamp' }
    );
    console.log('  ✅ Message chat+sender+timestamp index created');

    // Дополнительный индекс для быстрого поиска активных feedback запросов
    await FeedbackRequest.collection.createIndex(
      { status: 1, requestedAt: 1 },
      { name: 'feedback_request_status_requestedAt' }
    );
    console.log('  ✅ Feedback request status+requestedAt index created');

    // Дополнительный индекс для аналитики поисков
    await SearchHistory.collection.createIndex(
      { 'query.category': 1, timestamp: -1 },
      { name: 'search_history_category_timestamp' }
    );
    console.log('  ✅ Search history category+timestamp index created');

    // Проверяем и создаем text index для поиска пользователей (если еще не создан)
    try {
      await User.collection.createIndex(
        {
          'profile.company': 'text',
          'profile.skills': 'text',
          firstName: 'text',
          lastName: 'text'
        },
        {
          name: 'user_text_search',
          weights: {
            'profile.company': 3,
            'profile.skills': 2,
            firstName: 1,
            lastName: 1
          },
          default_language: 'russian'
        }
      );
      console.log('  ✅ User text search index created');
    } catch (error: unknown) {
      // Если индекс уже существует, это не ошибка
      if (error instanceof Error && 'code' in error && error.code === 85) {
        console.log('  ℹ️  User text search index already exists');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Error creating additional indexes:', error);
    throw error;
  }
};

/**
 * Функция для удаления всех индексов (используется для миграций)
 */
export const dropAllIndexes = async (): Promise<void> => {
  try {
    console.log('🗑️  Dropping all database indexes...');

    const collections = [
      User.collection,
      Chat.collection,
      Message.collection,
      FeedbackRequest.collection,
      SearchHistory.collection,
      OnlineStatus.collection
    ];

    for (const collection of collections) {
      await collection.dropIndexes();
      console.log(`  ✅ Dropped all indexes for ${collection.collectionName}`);
    }

    console.log('🎉 All indexes dropped successfully!');

  } catch (error: unknown) {
    // Игнорируем ошибку если коллекция не существует
    if (error instanceof Error && 'code' in error && error.code === 26) {
      console.log('ℹ️  Some collections do not exist yet, skipping...');
    } else {
      console.error('❌ Error dropping indexes:', error);
      throw error;
    }
  }
};

/**
 * Функция для получения статистики по индексам
 */
export const getIndexesStats = async (): Promise<Record<string, any>> => {
  try {
    const stats: Record<string, any> = {};

    const collections = [
      { name: 'users', model: User },
      { name: 'chats', model: Chat },
      { name: 'messages', model: Message },
      { name: 'feedbackRequests', model: FeedbackRequest },
      { name: 'searchHistory', model: SearchHistory },
      { name: 'onlineStatus', model: OnlineStatus }
    ];

    for (const { name, model } of collections) {
      try {
        const indexes = await model.collection.listIndexes().toArray();
        stats[name] = indexes.map((index: { name: string; key: Record<string, any>; unique?: boolean; sparse?: boolean }) => ({
          name: index.name,
          key: index.key,
          unique: index.unique || false,
          sparse: index.sparse || false
        }));
      } catch (error: unknown) {
        stats[name] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return stats;

  } catch (error) {
    console.error('❌ Error getting indexes stats:', error);
    throw error;
  }
};

export default {
  createIndexes,
  dropAllIndexes,
  getIndexesStats
};
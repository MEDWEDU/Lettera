// Экспорт всех моделей
export { User, IUser, IUserProfile } from './models/User';
export { Chat, IChat, IChatLastMessage, IChatUnreadCount } from './models/Chat';
export { Message, IMessage, IMessageMedia } from './models/Message';
export { FeedbackRequest, IFeedbackRequest } from './models/FeedbackRequest';
export {
  SearchHistory,
  ISearchHistory,
  ISearchQuery,
} from './models/SearchHistory';
export { OnlineStatus, IOnlineStatus } from './models/OnlineStatus';
export { MediaFile, IMediaFile } from './models/MediaFile';

// Экспорт функций подключения
export {
  connectDB,
  disconnectDB,
  getConnectionState,
} from './config/connection';
export { getDatabaseConfig } from './config/database';
export type { DatabaseConfig } from './config/database';

// Экспорт функций управления индексами
export {
  createIndexes,
  dropAllIndexes,
  getIndexesStats,
} from './indexes/indexes';

// Экспорт S3 сервиса
export { s3Service } from './services/S3Service';

// Импортируем модели для default экспорта
import { User } from './models/User';
import { Chat } from './models/Chat';
import { Message } from './models/Message';
import { FeedbackRequest } from './models/FeedbackRequest';
import { SearchHistory } from './models/SearchHistory';
import { OnlineStatus } from './models/OnlineStatus';
import { MediaFile } from './models/MediaFile';
import {
  connectDB,
  disconnectDB,
  getConnectionState,
} from './config/connection';
import { getDatabaseConfig } from './config/database';
import {
  createIndexes,
  dropAllIndexes,
  getIndexesStats,
} from './indexes/indexes';

export default {
  // Models
  User,
  Chat,
  Message,
  FeedbackRequest,
  SearchHistory,
  OnlineStatus,
  MediaFile,

  // Connection functions
  connectDB,
  disconnectDB,
  getConnectionState,
  getDatabaseConfig,

  // Index functions
  createIndexes,
  dropAllIndexes,
  getIndexesStats,
};

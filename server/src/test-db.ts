import { connectDB, createIndexes, User, Chat, Message, FeedbackRequest, SearchHistory, OnlineStatus } from './database';

/**
 * Тестовый скрипт для проверки работы с базой данных
 * Запускается командой: npm run test-db
 */
const testDatabase = async () => {
  try {
    console.log('🧪 Starting database tests...\n');

    // 1. Подключаемся к базе данных
    console.log('1. Connecting to database...');
    await connectDB();
    console.log('✅ Connected to database successfully\n');

    // 2. Создаем индексы
    console.log('2. Creating indexes...');
    await createIndexes();
    console.log('✅ Indexes created successfully\n');

    // 3. Тест создания пользователя
    console.log('3. Testing User model...');
    
    // Создаем тестового пользователя
    const testUser = new User({
      email: 'test@example.com',
      passwordHash: 'hashed_password_that_is_at_least_60_characters_long_for_bcrypt_123456789012345678901234567890123456789012345678901234567890',
      firstName: 'Тест',
      lastName: 'Пользователь',
      profile: {
        position: 'Разработчик',
        company: 'TechCorp',
        category: 'IT',
        skills: ['JavaScript', 'TypeScript', 'React']
      },
      status: 'online',
      emailVerified: true
    });

    const savedUser = await testUser.save();
    console.log(`✅ User created: ${savedUser.firstName} ${savedUser.lastName} (${savedUser.email})`);
    console.log(`   Profile: ${savedUser.profile?.position} в ${savedUser.profile?.company}`);
    console.log(`   Skills: ${savedUser.profile?.skills?.join(', ')}\n`);

    // 4. Тест создания второго пользователя и чата
    console.log('4. Testing Chat model...');
    
    const testUser2 = new User({
      email: 'user2@example.com',
      passwordHash: 'hashed_password_that_is_at_least_60_characters_long_for_bcrypt_123456789012345678901234567890123456789012345678901234567890',
      firstName: 'Второй',
      lastName: 'Тестовый',
      profile: {
        position: 'Дизайнер',
        company: 'DesignStudio',
        category: 'Design',
        skills: ['Figma', 'UI/UX', 'Adobe Creative Suite']
      },
      status: 'offline',
      emailVerified: false
    });

    const savedUser2 = await testUser2.save();
    console.log(`✅ Second user created: ${savedUser2.firstName} ${savedUser2.lastName}`);

    // Создаем чат между пользователями
    const testChat = new Chat({
      type: 'private',
      participants: [savedUser._id, savedUser2._id],
      lastMessage: {
        content: 'Привет! Это тестовое сообщение.',
        senderId: savedUser._id,
        timestamp: new Date()
      },
      unreadCount: {
        [(savedUser._id as any).toString()]: 0,
        [(savedUser2._id as any).toString()]: 1
      }
    });

    const savedChat = await testChat.save();
    console.log(`✅ Chat created between ${savedUser.firstName} and ${savedUser2.firstName}\n`);

    // 5. Тест создания сообщения
    console.log('5. Testing Message model...');
    
    const testMessage = new Message({
      chatId: savedChat._id,
      senderId: savedUser._id,
      content: 'Привет! Как дела?',
      timestamp: new Date(),
      feedbackRequested: true
    });

    const savedMessage = await testMessage.save();
    console.log(`✅ Message created: "${savedMessage.content}"`);
    console.log(`   Feedback requested: ${savedMessage.feedbackRequested}\n`);

    // 6. Тест создания запроса обратной связи
    console.log('6. Testing FeedbackRequest model...');
    
    const feedbackRequest = new FeedbackRequest({
      messageId: savedMessage._id,
      requesterId: savedUser._id,
      responderId: savedUser2._id,
      chatId: savedChat._id,
      status: 'pending',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +7 дней
    });

    const savedFeedbackRequest = await feedbackRequest.save();
    console.log(`✅ Feedback request created`);
    console.log(`   Status: ${savedFeedbackRequest.status}`);
    console.log(`   Expires: ${savedFeedbackRequest.expiresAt.toLocaleDateString()}\n`);

    // 7. Тест истории поиска
    console.log('7. Testing SearchHistory model...');
    
    const searchHistory = new SearchHistory({
      userId: savedUser._id,
      query: {
        category: 'IT',
        company: 'TechCorp',
        skills: ['JavaScript', 'React']
      },
      resultsCount: 5,
      timestamp: new Date()
    });

    const savedSearchHistory = await searchHistory.save();
    console.log(`✅ Search history created`);
    console.log(`   Query: ${savedSearchHistory.query.category} / ${savedSearchHistory.query.company}`);
    console.log(`   Results: ${savedSearchHistory.resultsCount}\n`);

    // 8. Тест статуса онлайн
    console.log('8. Testing OnlineStatus model...');
    
    const onlineStatus = new OnlineStatus({
      userId: savedUser._id,
      status: 'online',
      lastPing: new Date()
    });

    const savedOnlineStatus = await onlineStatus.save();
    console.log(`✅ Online status created`);
    console.log(`   Status: ${savedOnlineStatus.status}`);
    console.log(`   Last ping: ${savedOnlineStatus.lastPing.toLocaleString()}\n`);

    // 9. Тест запросов с populate
    console.log('9. Testing populated queries...');
    
    // Получаем чат с участниками
    const populatedChat = await Chat.findById(savedChat._id)
      .populate('participants', 'firstName lastName email profile.position profile.company')
      .exec();
    
    if (populatedChat) {
      console.log('✅ Chat with populated participants:');
      populatedChat.participants.forEach((participant: any) => {
        console.log(`   - ${participant.firstName} ${participant.lastName} (${participant.profile?.position} в ${participant.profile?.company})`);
      });
    }

    // Получаем сообщение с информацией об отправителе
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('senderId', 'firstName lastName')
      .exec();
    
    if (populatedMessage) {
      console.log(`\n✅ Message with populated sender: "${populatedMessage.content}" от ${(populatedMessage.senderId as any)?.firstName} ${(populatedMessage.senderId as any)?.lastName}`);
    }

    // 10. Тест статистики
    console.log('\n10. Database statistics...');
    
    const userCount = await User.countDocuments();
    const chatCount = await Chat.countDocuments();
    const messageCount = await Message.countDocuments();
    
    console.log(`✅ Database statistics:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Chats: ${chatCount}`);
    console.log(`   Messages: ${messageCount}`);

    console.log('\n🎉 All database tests completed successfully!');
    console.log('\n💡 Note: In a real application, you would typically delete test data after testing.');
    
    // Очистка тестовых данных (опционально)
    console.log('\n🧹 Cleaning up test data...');
    await User.deleteMany({ email: { $in: ['test@example.com', 'user2@example.com'] } });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
};

// Запускаем тесты если файл выполнен напрямую
if (require.main === module) {
  testDatabase().then(() => {
    console.log('\n✨ Test completed. Exiting...');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

export default testDatabase;
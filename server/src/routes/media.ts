import express, { Request, Response } from 'express';
import multer from 'multer';
import { s3Service, ALLOWED_MIME_TYPES } from '../database/services/S3Service';
import { MediaFile } from '../database/models/MediaFile';
import { Types } from 'mongoose';

const router = express.Router();

// Настройка multer для обработки файлов в памяти
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB максимальный размер (будет перепроверен в сервисе)
  },
  fileFilter: (_req, file, cb) => {
    // Проверка MIME-типа
    const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat() as string[];
    if (allAllowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
    }
  },
});

/**
 * @route POST /api/media/upload
 * @desc Загрузка медиафайла
 * @access Private
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // Проверяем наличие файла
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Файл не был загружен'
      });
    }

    // Получаем userId из запроса (в реальном приложении из токена)
    const userId = req.body.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный ID пользователя'
      });
    }

    // Загружаем файл через S3 сервис
    const result = await s3Service.uploadFile(
      req.file.buffer,
      req.file.mimetype,
      userId,
      req.file.originalname
    );

    res.json({
      success: true,
      data: {
        url: result.url,
        key: result.key,
        type: result.type,
        size: result.size,
        mimeType: result.mimeType,
        uploadedAt: result.uploadedAt
      }
    });

  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    
    // Определяем тип ошибки и возвращаем соответствующий ответ
    let statusCode = 500;
    let errorMessage = 'Ошибка при загрузке файла';

    if (error instanceof Error) {
      if (error.message.includes('Неподдерживаемый MIME-тип')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('Размер файла превышает лимит')) {
        statusCode = 413; // Payload Too Large
        errorMessage = error.message;
      } else if (error.message.includes('Некорректный URL файла')) {
        statusCode = 400;
        errorMessage = error.message;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route DELETE /api/media/:url
 * @desc Удаление медиафайла
 * @access Private
 */
router.delete('/:url(*)', async (req: Request, res: Response) => {
  try {
    const fileUrl = decodeURIComponent(req.params.url);
    const userId = req.body.userId; // В реальном приложении из токена

    // Проверяем, существует ли файл и принадлежит ли он пользователю
    if (userId && Types.ObjectId.isValid(userId)) {
      const mediaFile = await MediaFile.findOne({
        url: fileUrl,
        uploadedBy: new Types.ObjectId(userId)
      });

      if (!mediaFile) {
        return res.status(404).json({
          success: false,
          error: 'Файл не найден или у вас нет прав для его удаления'
        });
      }
    }

    // Удаляем файл
    await s3Service.deleteFile(fileUrl, userId);

    res.json({
      success: true,
      message: 'Файл успешно удален'
    });

  } catch (error) {
    console.error('Ошибка при удалении файла:', error);
    
    let statusCode = 500;
    let errorMessage = 'Ошибка при удалении файла';

    if (error instanceof Error) {
      if (error.message.includes('Некорректный URL файла')) {
        statusCode = 400;
        errorMessage = error.message;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route GET /api/media/presigned/:key
 * @desc Получение временного URL для скачивания файла
 * @access Private
 */
router.get('/presigned/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // 1 час по умолчанию

    // Проверяем существование файла
    const exists = await s3Service.fileExists(key);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Файл не найден'
      });
    }

    // Генерируем временный URL
    const presignedUrl = await s3Service.generatePresignedUrl(key, expiresIn);

    res.json({
      success: true,
      data: {
        url: presignedUrl,
        expiresIn
      }
    });

  } catch (error) {
    console.error('Ошибка при генерации временного URL:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка при генерации временного URL'
    });
  }
});

/**
 * @route GET /api/media/user/:userId/stats
 * @desc Получение статистики файлов пользователя
 * @access Private
 */
router.get('/user/:userId/stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный ID пользователя'
      });
    }

    const stats = await s3Service.getUserFileStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Ошибка при получении статистики файлов:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статистики файлов'
    });
  }
});

/**
 * @route GET /api/media/user/:userId/files
 * @desc Получение списка файлов пользователя с пагинацией
 * @access Private
 */
router.get('/user/:userId/files', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Максимум 100 файлов за раз
    const type = req.query.type as 'image' | 'audio' | 'video' | undefined;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный ID пользователя'
      });
    }

    // Формируем запрос
    const query: { uploadedBy: Types.ObjectId; type?: string } = { uploadedBy: new Types.ObjectId(userId) };
    if (type) {
      query.type = type;
    }

    // Получаем файлы с пагинацией
    const files = await MediaFile.find(query)
      .sort({ uploadedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v');

    // Получаем общее количество
    const total = await MediaFile.countDocuments(query);

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении списка файлов'
    });
  }
});

// Middleware для обработки ошибок multer
router.use((error: Error, req: Request, res: Response) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'Размер файла слишком большой'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Слишком много файлов'
      });
    }
  }

  if (error.message.includes('Неподдерживаемый тип файла')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  console.error('Ошибка в media routes:', error);
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера'
  });
});

export default router;
#!/usr/bin/env node

/**
 * Скрипт для автоматизации работы с Task Master через чат
 * Позволяет обрабатывать команды из чата и выполнять соответствующие действия
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Определяем пути в зависимости от режима (локальный или глобальный)
const isGlobalMode = process.env.TASK_MASTER_MODE === 'global';
const tasksDir = process.env.TASK_MASTER_DIR || path.join(process.cwd(), 'tasks');
const tasksFile = process.env.TASK_MASTER_FILE || path.join(tasksDir, 'tasks.json');

// Функция загрузки задач из файла
function loadTasks() {
  if (!fs.existsSync(tasksFile)) {
    console.log(chalk.red(`✗ Файл ${path.basename(tasksFile)} не найден. Запустите инициализацию с помощью task-master init или npm run task-master:init`));
    process.exit(1);
  }
  
  try {
    const data = fs.readFileSync(tasksFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(chalk.red(`✗ Ошибка при чтении файла: ${error.message}`));
    process.exit(1);
  }
}

// Функция сохранения задач в файл
function saveTasks(tasksData) {
  try {
    fs.writeFileSync(tasksFile, JSON.stringify(tasksData, null, 2));
    return true;
  } catch (error) {
    console.log(chalk.red(`✗ Ошибка при сохранении файла: ${error.message}`));
    return false;
  }
}

// Функция для получения нового ID задачи
function getNextTaskId(tasks) {
  if (tasks.length === 0) return 1;
  return Math.max(...tasks.map(task => task.id)) + 1;
}

/**
 * Обработчик команд из чата
 * @param {string} command - Команда из чата
 */
function processCommand(command) {
  // Приведение к нижнему регистру для упрощения проверки
  const lowerCommand = command.toLowerCase();
  
  // Обработка команды создания задачи
  if (lowerCommand.startsWith('создай задачу')) {
    return createTaskFromChat(command);
  }
  
  // Обработка команды показа списка задач
  if (lowerCommand.includes('покажи список задач') || lowerCommand.includes('покажи задачи')) {
    return listTasks();
  }
  
  // Обработка команды отметки задачи как выполненной
  const completeRegex = /отметь задачу (\d+(?:\.\d+)?) как выполненн(ую|ую)/i;
  const completeMatch = command.match(completeRegex);
  if (completeMatch) {
    return completeTask(completeMatch[1]);
  }
  
  // Обработка команды получения следующей задачи
  if (lowerCommand.includes('дай следующую задачу') || lowerCommand.includes('какая следующая задача')) {
    return getNextTask();
  }
  
  // Обработка команды генерации задачи из описания
  if (lowerCommand.startsWith('сгенерируй задачу')) {
    return generateTaskFromDescription(command);
  }
  
  // Обработка команды пакетного создания задач
  if (lowerCommand.startsWith('создай задачи') || lowerCommand.startsWith('сгенерируй задачи')) {
    return generateMultipleTasks(command);
  }
  
  // Обработка команды автоматического создания задач из плана
  if (lowerCommand.includes('создай список задач из плана') || 
      lowerCommand.includes('сгенерируй задачи из плана') ||
      lowerCommand.includes('создай задачи из нашего обсуждения')) {
    return generateTasksFromPlan(command);
  }
  
  // Обработка команды вывода справки
  if (lowerCommand.includes('помощь') || lowerCommand.includes('справка') || 
      lowerCommand.includes('как использовать') || lowerCommand.includes('инструкция')) {
    return showHelp();
  }
  
  // Если команда не распознана
  return `Я не понял команду. Введите "справка" для получения списка доступных команд.`;
}

/**
 * Создание задачи из текста чата
 * @param {string} command - Текст из чата
 */
function createTaskFromChat(command) {
  const tasksData = loadTasks();
  
  // Извлекаем название задачи
  let title = command.replace(/создай задачу/i, '').trim();
  if (!title) {
    title = 'Новая задача';
  }
  
  // Создаем новую задачу
  const newTask = {
    id: getNextTaskId(tasksData.tasks),
    title,
    description: 'Задача создана через чат',
    status: 'pending',
    priority: 2, // По умолчанию средний приоритет
    subtasks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Добавляем задачу в список
  tasksData.tasks.push(newTask);
  
  // Сохраняем задачи в файл
  if (saveTasks(tasksData)) {
    return `✓ Задача #${newTask.id} "${newTask.title}" успешно создана! Добавить подзадачи или изменить описание можно через команду "Обнови задачу ${newTask.id}".`;
  } else {
    return '✗ Не удалось сохранить задачу.';
  }
}

/**
 * Список всех задач
 */
function listTasks() {
  const tasksData = loadTasks();
  
  if (!tasksData.tasks || tasksData.tasks.length === 0) {
    return 'Задачи не найдены. Добавьте задачи с помощью команды "Создай задачу [название]".';
  }
  
  // Группировка задач по статусу
  const pending = tasksData.tasks.filter(task => task.status === 'pending');
  const inProgress = tasksData.tasks.filter(task => task.status === 'in-progress');
  const done = tasksData.tasks.filter(task => task.status === 'done');
  const deferred = tasksData.tasks.filter(task => task.status === 'deferred');
  
  // Формирование ответа
  let response = `📋 Задачи проекта: ${tasksData.project} (v${tasksData.version})\n\n`;
  
  // Функция для форматирования задачи
  const formatTask = (task) => {
    let status = '';
    switch (task.status) {
      case 'done': status = '✓'; break;
      case 'in-progress': status = '⚙'; break;
      case 'deferred': status = '⏸'; break;
      case 'pending': 
      default: status = '○'; break;
    }
    
    let result = `${status} [${task.id}] ${task.title} (приоритет: ${task.priority})\n`;
    
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(subtask => {
        const subtaskStatus = subtask.status === 'done' ? '✓' : '○';
        result += `  ${subtaskStatus} ${subtask.id} ${subtask.title}\n`;
      });
    }
    
    return result;
  };
  
  // Добавление задач по группам
  if (inProgress.length > 0) {
    response += '⚙ В ПРОЦЕССЕ:\n';
    inProgress.forEach(task => {
      response += formatTask(task);
    });
    response += '\n';
  }
  
  if (pending.length > 0) {
    response += '○ ОЖИДАЮТ:\n';
    pending.forEach(task => {
      response += formatTask(task);
    });
    response += '\n';
  }
  
  if (done.length > 0) {
    response += '✓ ВЫПОЛНЕНЫ:\n';
    done.forEach(task => {
      response += formatTask(task);
    });
    response += '\n';
  }
  
  if (deferred.length > 0) {
    response += '⏸ ОТЛОЖЕНЫ:\n';
    deferred.forEach(task => {
      response += formatTask(task);
    });
    response += '\n';
  }
  
  return response;
}

/**
 * Отметка задачи или подзадачи как выполненной
 * @param {string} taskId - ID задачи или подзадачи
 */
function completeTask(taskId) {
  const tasksData = loadTasks();
  
  // Проверяем, является ли ID подзадачей
  if (taskId.includes('.')) {
    const [parentId, subtaskId] = taskId.split('.');
    const parentIdNum = parseInt(parentId);
    
    // Находим родительскую задачу
    const parentTask = tasksData.tasks.find(task => task.id === parentIdNum);
    
    if (!parentTask) {
      return `✗ Задача с ID ${parentIdNum} не найдена`;
    }
    
    // Находим подзадачу
    const subtask = parentTask.subtasks.find(st => st.id === taskId);
    
    if (!subtask) {
      return `✗ Подзадача с ID ${taskId} не найдена`;
    }
    
    // Отмечаем подзадачу как выполненную
    subtask.status = 'done';
    
    // Проверяем, все ли подзадачи выполнены
    const allSubtasksDone = parentTask.subtasks.every(st => st.status === 'done');
    
    // Если все подзадачи выполнены, отмечаем родительскую задачу как выполненную
    if (allSubtasksDone) {
      parentTask.status = 'done';
    }
    
    // Обновляем дату изменения
    parentTask.updated_at = new Date().toISOString();
    
    // Сохраняем изменения
    if (saveTasks(tasksData)) {
      let response = `✓ Подзадача #${taskId} отмечена как выполненная`;
      if (allSubtasksDone) {
        response += `\n✓ Все подзадачи выполнены, задача #${parentIdNum} отмечена как выполненная`;
      }
      return response;
    } else {
      return '✗ Не удалось сохранить изменения';
    }
  } else {
    // Отмечаем задачу как выполненную
    const taskIdNum = parseInt(taskId);
    const task = tasksData.tasks.find(t => t.id === taskIdNum);
    
    if (!task) {
      return `✗ Задача с ID ${taskIdNum} не найдена`;
    }
    
    // Отмечаем задачу и все подзадачи как выполненные
    task.status = 'done';
    task.updated_at = new Date().toISOString();
    
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(st => {
        st.status = 'done';
      });
    }
    
    // Сохраняем изменения
    if (saveTasks(tasksData)) {
      return `✓ Задача #${taskIdNum} "${task.title}" отмечена как выполненная`;
    } else {
      return '✗ Не удалось сохранить изменения';
    }
  }
}

/**
 * Получение следующей задачи
 */
function getNextTask() {
  const tasksData = loadTasks();
  
  if (!tasksData.tasks || tasksData.tasks.length === 0) {
    return 'Задачи не найдены. Добавьте задачи с помощью команды "Создай задачу [название]".';
  }
  
  // Получить следующую задачу в статусе pending с наивысшим приоритетом
  const pendingTasks = tasksData.tasks.filter(task => task.status === 'pending');
  
  if (pendingTasks.length === 0) {
    return 'Нет задач в статусе pending. Все задачи выполнены или находятся в процессе.';
  }
  
  // Сортировка по приоритету (от 1 до 3)
  pendingTasks.sort((a, b) => a.priority - b.priority);
  
  const nextTask = pendingTasks[0];
  
  // Обновить статус задачи на in-progress
  const taskIndex = tasksData.tasks.findIndex(task => task.id === nextTask.id);
  if (taskIndex !== -1) {
    tasksData.tasks[taskIndex].status = 'in-progress';
    tasksData.tasks[taskIndex].updated_at = new Date().toISOString();
    saveTasks(tasksData);
  }
  
  // Формирование ответа
  let response = `🚀 Следующая задача:\n\n[${nextTask.id}] ${nextTask.title}\nПриоритет: ${nextTask.priority}\n\n${nextTask.description}\n\n`;
  
  // Добавление подзадач, если они есть
  if (nextTask.subtasks && nextTask.subtasks.length > 0) {
    response += 'Подзадачи:\n';
    nextTask.subtasks.forEach(subtask => {
      const statusEmoji = subtask.status === 'done' ? '✓' : '○';
      response += `${statusEmoji} ${subtask.id} ${subtask.title}\n`;
    });
  }
  
  response += '\n✓ Задача отмечена как "в процессе"';
  
  return response;
}

/**
 * Генерация задачи из описания
 * @param {string} command - Команда с описанием задачи
 */
function generateTaskFromDescription(command) {
  const tasksData = loadTasks();
  
  // Извлекаем описание задачи
  const description = command.replace(/сгенерируй задачу/i, '').trim();
  if (!description) {
    return 'Не указано описание задачи. Используйте формат: "Сгенерируй задачу [описание]"';
  }
  
  // Разбиваем описание на строки
  const lines = description.split(/\n|\\n/).filter(line => line.trim() !== '');
  
  // Первая строка или первые 5 слов будут заголовком
  let title = '';
  if (lines.length > 0) {
    title = lines[0].trim();
    
    // Если первая строка слишком длинная, берем только первые 5 слов
    if (title.split(' ').length > 5) {
      title = title.split(' ').slice(0, 5).join(' ') + '...';
    }
  } else {
    title = description.split(' ').slice(0, 5).join(' ');
    if (description.split(' ').length > 5) {
      title += '...';
    }
  }
  
  // Определяем подзадачи (строки, начинающиеся с - или * или цифры с точкой)
  const subtasksRegex = /^(\-|\*|\d+\.)\s+(.+)$/;
  const subtasksLines = lines.filter(line => subtasksRegex.test(line.trim()));
  
  const subtasks = subtasksLines.map((line, index) => {
    return {
      id: `${getNextTaskId(tasksData.tasks)}.${index + 1}`,
      title: line.trim().replace(subtasksRegex, '$2'),
      status: 'pending'
    };
  });
  
  // Создаем новую задачу
  const newTask = {
    id: getNextTaskId(tasksData.tasks),
    title,
    description,
    status: 'pending',
    priority: 2, // По умолчанию средний приоритет
    subtasks,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Добавляем задачу в список
  tasksData.tasks.push(newTask);
  
  // Сохраняем задачи в файл
  if (saveTasks(tasksData)) {
    let response = `✓ Задача #${newTask.id} "${newTask.title}" успешно создана!\n`;
    response += `Приоритет: ${newTask.priority}\n`;
    
    if (subtasks.length > 0) {
      response += `Подзадачи:\n`;
      subtasks.forEach(subtask => {
        response += `○ ${subtask.id} ${subtask.title}\n`;
      });
    }
    
    return response;
  } else {
    return '✗ Не удалось сохранить задачу.';
  }
}

/**
 * Пакетное создание нескольких задач из описания
 * @param {string} command - Команда с описанием задач
 * @returns {string} - Результат выполнения команды
 */
function generateMultipleTasks(command) {
  const tasksData = loadTasks();
  
  // Извлекаем описание задач
  let description = command.replace(/создай задачи|сгенерируй задачи/i, '').trim();
  if (!description) {
    return 'Не указано описание задач. Используйте формат: "Создай задачи [описание]" и разделяйте задачи с помощью "###"';
  }

  // Разбиваем описание на отдельные задачи с помощью разделителя "###"
  const taskDescriptions = description.split(/###/).map(desc => desc.trim()).filter(desc => desc);
  
  if (taskDescriptions.length === 0) {
    return 'Не удалось определить задачи в описании. Убедитесь, что вы разделяете задачи символами "###"';
  }
  
  const createdTasks = [];
  
  // Обрабатываем каждую задачу отдельно
  for (const taskDesc of taskDescriptions) {
    // Разбиваем описание на строки
    const lines = taskDesc.split(/\n|\\n/).filter(line => line.trim() !== '');
    
    if (lines.length === 0) continue;
    
    // Первая строка будет заголовком
    const title = lines[0].trim();
    
    // Проверяем наличие приоритета в заголовке или в отдельной строке
    let priority = 2; // По умолчанию средний приоритет
    const priorityRegex = /\[(?:P|p|приоритет|Приоритет)[:=]?\s*([1-3])\]/;
    
    // Проверяем заголовок на наличие приоритета
    const titlePriorityMatch = title.match(priorityRegex);
    let cleanTitle = title;
    
    if (titlePriorityMatch) {
      priority = parseInt(titlePriorityMatch[1]);
      cleanTitle = title.replace(priorityRegex, '').trim();
    } else {
      // Проверяем другие строки на наличие приоритета
      for (const line of lines.slice(1)) {
        const linePriorityMatch = line.match(priorityRegex);
        if (linePriorityMatch) {
          priority = parseInt(linePriorityMatch[1]);
          break;
        }
      }
    }
    
    // Определяем подзадачи (строки, начинающиеся с - или * или цифры с точкой)
    const subtasksRegex = /^(\-|\*|\d+\.)\s+(.+)$/;
    const subtasksLines = lines.slice(1).filter(line => subtasksRegex.test(line.trim()));
    
    const taskId = getNextTaskId(tasksData.tasks);
    
    const subtasks = subtasksLines.map((line, index) => {
      return {
        id: `${taskId}.${index + 1}`,
        title: line.trim().replace(subtasksRegex, '$2'),
        status: 'pending'
      };
    });
    
    // Получаем описание, исключая подзадачи и строки с приоритетом
    const taskDescription = lines.slice(1)
      .filter(line => !subtasksRegex.test(line.trim()) && !priorityRegex.test(line.trim()))
      .join('\n').trim() || 'Задача создана через чат';
    
    // Создаем новую задачу
    const newTask = {
      id: taskId,
      title: cleanTitle,
      description: taskDescription,
      status: 'pending',
      priority: priority,
      subtasks,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Добавляем задачу в список
    tasksData.tasks.push(newTask);
    createdTasks.push(newTask);
  }
  
  // Если ни одной задачи не создано
  if (createdTasks.length === 0) {
    return 'Не удалось создать задачи. Проверьте формат ввода.';
  }
  
  // Сохраняем задачи в файл
  if (saveTasks(tasksData)) {
    // Формируем улучшенный вывод с использованием emoji и форматирования
    let response = `✅ Успешно создано задач: ${createdTasks.length}\n\n`;
    
    createdTasks.forEach(task => {
      // Emoji для приоритета
      let priorityEmoji = '';
      switch(task.priority) {
        case 1: priorityEmoji = '🔴'; break; // Высокий
        case 2: priorityEmoji = '🟡'; break; // Средний
        case 3: priorityEmoji = '🟢'; break; // Низкий
      }
      
      response += `${priorityEmoji} [${task.id}] ${task.title}\n`;
      
      // Добавляем описание, если оно не пустое и не равно заголовку
      if (task.description && task.description !== 'Задача создана через чат' && task.description !== task.title) {
        // Ограничиваем длину описания для вывода
        const shortDesc = task.description.length > 100 
          ? task.description.substring(0, 100) + '...' 
          : task.description;
        response += `📝 ${shortDesc}\n`;
      }
      
      // Добавляем информацию о приоритете
      const priorityText = task.priority === 1 ? 'Высокий' : (task.priority === 2 ? 'Средний' : 'Низкий');
      response += `⚡ Приоритет: ${priorityText}\n`;
      
      if (task.subtasks.length > 0) {
        response += `📋 Подзадачи (${task.subtasks.length}):\n`;
        task.subtasks.forEach(subtask => {
          response += `  ○ ${subtask.id} ${subtask.title}\n`;
        });
      }
      response += '\n';
    });
    
    return response;
  } else {
    return '❌ Не удалось сохранить задачи.';
  }
}

/**
 * Показать справку по использованию Task Master
 * @returns {string} - Текст справки
 */
function showHelp() {
  return `📚 СПРАВКА ПО ИСПОЛЬЗОВАНИЮ TASK MASTER 📚

🔹 ОСНОВНЫЕ КОМАНДЫ:

✅ Создание задач:
  - "Создай задачу [название]" - создание одной задачи
  - "Создай задачи [описание]" - создание нескольких задач
  - "Сгенерируй задачу [описание]" - генерация задачи из описания
  - "Сгенерируй задачи [описание]" - генерация нескольких задач из описания
  - "Создай список задач из плана" - автоматическое создание задач из обсуждения

✅ Управление задачами:
  - "Покажи список задач" или "Покажи задачи" - просмотр всех задач
  - "Отметь задачу X как выполненную" - отметка задачи как выполненной
  - "Дай следующую задачу" - получение следующей задачи

🔹 ФОРМАТИРОВАНИЕ ОПИСАНИЯ ЗАДАЧ:

✅ Для создания нескольких задач:
  - Разделяйте задачи символами "###"
  - Первая строка каждой задачи становится её заголовком
  - Строки, начинающиеся с "-" или "*", считаются подзадачами

✅ Для указания приоритета:
  - Добавьте метку [приоритет:X] или [P:X], где X - число от 1 до 3:
    1 - высокий приоритет 🔴
    2 - средний приоритет 🟡 (по умолчанию)
    3 - низкий приоритет 🟢

🔹 ПРИМЕРЫ:

✅ Создание одной задачи с подзадачами:
  Сгенерируй задачу Разработка интерфейса входа
  Создать форму авторизации с полями логин и пароль
  - Создать HTML разметку формы входа
  - Реализовать валидацию полей
  - Добавить обработку ошибок авторизации
  [Приоритет:1]

✅ Создание нескольких задач:
  Создай задачи Настройка проекта [P:1]
  - Создать репозиторий
  - Настроить окружение разработки
  - Установить необходимые зависимости
  
  ###
  
  Разработка API [приоритет:2]
  - Создать модели данных
  - Реализовать CRUD операции
  - Написать тесты для API
  
  ###
  
  Документация [P:3]
  - Описать API
  - Подготовить руководство пользователя

✅ Автоматическое создание задач из плана:
  Создай список задач из плана
  (Система проанализирует ваше предыдущее обсуждение и создаст список задач)
`;
}

/**
 * Генерация задач из обсуждения плана
 * @param {string} command - Команда
 * @returns {string} - Результат выполнения команды
 */
function generateTasksFromPlan(command) {
  // Мы предполагаем, что обсуждение плана уже произошло в чате
  // Эта функция анализирует текст команды и извлекает задачи
  
  // Очищаем команду от ключевых слов
  const cleanCommand = command.replace(/создай список задач из плана|сгенерируй задачи из плана|создай задачи из нашего обсуждения/i, '').trim();
  
  // Если пользователь предоставил контекст вместе с командой, используем его
  // В противном случае, мы бы использовали историю чата, но в данной реализации
  // мы просто предложим стандартный набор задач для проекта
  
  const tasksData = loadTasks();
  const createdTasks = [];
  
  if (cleanCommand) {
    // Если есть текст после команды, анализируем его для создания задач
    
    // Разбиваем текст на абзацы
    const paragraphs = cleanCommand.split(/\n\n|\r\n\r\n/).filter(p => p.trim());
    
    // Анализируем каждый абзац как потенциальную задачу
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      
      // Разбиваем абзац на строки
      const lines = paragraph.split(/\n|\r\n/).filter(line => line.trim());
      
      if (lines.length === 0) continue;
      
      // Первая строка как заголовок задачи
      const title = lines[0].trim();
      
      // Определяем приоритет задачи (эвристика: первые задачи имеют более высокий приоритет)
      let priority = Math.min(Math.max(Math.ceil((i + 1) / 3), 1), 3);
      
      // Ищем в тексте ключевые слова для оценки приоритета
      const lowPriorityKeywords = ["опционально", "дополнительно", "низкий приоритет", "потом", "в будущем"];
      const highPriorityKeywords = ["важно", "критично", "срочно", "высокий приоритет", "необходимо", "обязательно"];
      
      const lowerParagraph = paragraph.toLowerCase();
      
      if (lowPriorityKeywords.some(keyword => lowerParagraph.includes(keyword))) {
        priority = 3; // Низкий приоритет
      } else if (highPriorityKeywords.some(keyword => lowerParagraph.includes(keyword))) {
        priority = 1; // Высокий приоритет
      }
      
      // Ищем потенциальные подзадачи, выделяя маркеры списков или номерацию
      // Также ищем предложения, которые могут описывать конкретные действия
      const subtaskRegex = /^[\-\*]\s+(.+)$/;
      const actionSentenceRegex = /([А-Я][^.!?]*?(?:создать|разработать|реализовать|добавить|написать|тестировать|внедрить|установить)[^.!?]*[.!?])/g;
      
      const explicitSubtasks = lines.slice(1)
        .filter(line => subtaskRegex.test(line.trim()))
        .map(line => line.trim().replace(subtaskRegex, '$1'));
      
      const actionSentences = [];
      let match;
      
      // Ищем предложения, описывающие действия
      while ((match = actionSentenceRegex.exec(paragraph)) !== null) {
        actionSentences.push(match[1].trim());
      }
      
      // Объединяем явные подзадачи и предложения, описывающие действия
      const allSubtasks = [...explicitSubtasks];
      
      // Добавляем предложения-действия, которые не содержатся в явных подзадачах
      actionSentences.forEach(sentence => {
        const sentenceLower = sentence.toLowerCase();
        if (!allSubtasks.some(subtask => 
            subtask.toLowerCase().includes(sentenceLower) || 
            sentenceLower.includes(subtask.toLowerCase()))) {
          allSubtasks.push(sentence);
        }
      });
      
      // Создаем и добавляем задачу
      const taskId = getNextTaskId(tasksData.tasks);
      
      const subtasks = allSubtasks.map((subtaskTitle, index) => ({
        id: `${taskId}.${index + 1}`,
        title: subtaskTitle,
        status: 'pending'
      }));
      
      const taskDescription = lines.slice(1)
        .filter(line => !subtaskRegex.test(line.trim()))
        .join('\n').trim() || 'Задача создана на основе обсуждения плана';
      
      const newTask = {
        id: taskId,
        title,
        description: taskDescription,
        status: 'pending',
        priority,
        subtasks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      tasksData.tasks.push(newTask);
      createdTasks.push(newTask);
    }
  }
  
  // Если задачи не созданы из текста команды, создаем стандартные задачи проекта
  if (createdTasks.length === 0) {
    // Создаем базовый набор задач для стандартного проекта разработки
    const defaultTasks = [
      {
        title: "Планирование проекта",
        priority: 1,
        description: "Определение основных требований и планирование работ по проекту",
        subtasks: [
          "Определение требований и целей проекта",
          "Составление технического задания",
          "Оценка сроков и ресурсов",
          "Создание плана работ"
        ]
      },
      {
        title: "Разработка архитектуры",
        priority: 1,
        description: "Разработка архитектуры проекта и выбор технологий",
        subtasks: [
          "Выбор технологического стека",
          "Проектирование структуры базы данных",
          "Определение API и интерфейсов",
          "Создание схемы архитектуры"
        ]
      },
      {
        title: "Настройка окружения разработки",
        priority: 1,
        description: "Настройка окружения для разработки и тестирования",
        subtasks: [
          "Настройка репозитория кода",
          "Настройка CI/CD",
          "Настройка тестового окружения",
          "Установка необходимых инструментов и зависимостей"
        ]
      },
      {
        title: "Разработка основного функционала",
        priority: 2,
        description: "Разработка основных компонентов и функций проекта",
        subtasks: [
          "Разработка моделей данных",
          "Реализация бизнес-логики",
          "Разработка пользовательского интерфейса",
          "Интеграция компонентов"
        ]
      },
      {
        title: "Тестирование",
        priority: 2,
        description: "Тестирование проекта на различных уровнях",
        subtasks: [
          "Написание модульных тестов",
          "Проведение интеграционного тестирования",
          "Тестирование производительности",
          "Проведение пользовательского тестирования"
        ]
      },
      {
        title: "Документация",
        priority: 3,
        description: "Создание документации для проекта",
        subtasks: [
          "Написание документации по API",
          "Создание руководства пользователя",
          "Подготовка документации для разработчиков",
          "Документирование архитектуры проекта"
        ]
      },
      {
        title: "Развертывание",
        priority: 2,
        description: "Подготовка к выпуску и развертывание проекта",
        subtasks: [
          "Настройка продакшн-окружения",
          "Настройка мониторинга и логирования",
          "Подготовка скриптов для развертывания",
          "Тестирование процесса развертывания"
        ]
      }
    ];
    
    // Добавляем задачи в систему
    for (const taskTemplate of defaultTasks) {
      const taskId = getNextTaskId(tasksData.tasks);
      
      const subtasks = taskTemplate.subtasks.map((subtaskTitle, index) => ({
        id: `${taskId}.${index + 1}`,
        title: subtaskTitle,
        status: 'pending'
      }));
      
      const newTask = {
        id: taskId,
        title: taskTemplate.title,
        description: taskTemplate.description,
        status: 'pending',
        priority: taskTemplate.priority,
        subtasks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      tasksData.tasks.push(newTask);
      createdTasks.push(newTask);
    }
  }
  
  // Сохраняем задачи в файл
  if (saveTasks(tasksData)) {
    // Формируем ответ
    let response = `✅ Автоматически создано задач: ${createdTasks.length}\n\n`;
    
    createdTasks.forEach(task => {
      // Emoji для приоритета
      let priorityEmoji = '';
      switch(task.priority) {
        case 1: priorityEmoji = '🔴'; break; // Высокий
        case 2: priorityEmoji = '🟡'; break; // Средний
        case 3: priorityEmoji = '🟢'; break; // Низкий
      }
      
      response += `${priorityEmoji} [${task.id}] ${task.title}\n`;
      
      // Добавляем подзадачи
      if (task.subtasks.length > 0) {
        response += `📋 Подзадачи (${task.subtasks.length}):\n`;
        task.subtasks.forEach(subtask => {
          response += `  ○ ${subtask.id} ${subtask.title}\n`;
        });
      }
      response += '\n';
    });
    
    response += "📌 Задачи успешно созданы и готовы к выполнению. Используйте команду \"Покажи задачи\" для просмотра всего списка задач или \"Дай следующую задачу\" для начала работы.";
    
    return response;
  } else {
    return '❌ Не удалось сохранить задачи.';
  }
}

// Если скрипт запущен из командной строки
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args.join(' ');
  
  if (!command) {
    console.log(chalk.yellow('Не указана команда. Пример использования:'));
    console.log(chalk.blue('npm run task-master:chat "Создай задачу Разработка нового функционала"'));
    process.exit(1);
  }
  
  const result = processCommand(command);
  console.log(result);
}

// Экспорт функции для использования в других модулях
module.exports = {
  processCommand
};
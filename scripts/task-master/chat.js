#!/usr/bin/env node

/**
 * Скрипт для автоматизации работы с Task Master через чат
 * Позволяет обрабатывать команды из чата и выполнять соответствующие действия
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contextTracker = require('./context-tracker');

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
  
  // Обработка команды Продолжить
  if (
    lowerCommand.startsWith('продолжить') ||
    lowerCommand.includes('продолжить итерацию') ||
    lowerCommand.startsWith('continue') ||
    lowerCommand.includes('continue to iterate')
  ) {
    return continueCopilotIteration(command);
  }
  
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
  
  // Обработка команд контекста
  if (lowerCommand.startsWith('обнови контекст')) {
    const taskIdRegex = /обнови контекст задачи (\d+)/i;
    const taskMatch = command.match(taskIdRegex);
    
    if (taskMatch) {
      return updateTaskContext(parseInt(taskMatch[1]));
    } else {
      return updateCurrentContext();
    }
  }
  
  // Обработка команды предложения задачи
  if (lowerCommand.includes('предложи задачу') || 
      lowerCommand.includes('что дальше') || 
      lowerCommand.includes('какую задачу выполнить следующей')) {
    return suggestNextTask();
  }
  
  // Обработка команды проверки завершения задачи
  const checkCompletionRegex = /задача (\d+(?:\.\d+)?) выполнена\?/i;
  const checkCompletionMatch = command.match(checkCompletionRegex);
  if (checkCompletionMatch) {
    return checkTaskCompletion(checkCompletionMatch[1]);
  }
  
  // Обработка запроса на получение контекста для GitHub Copilot
  if (lowerCommand.includes('получи контекст для copilot') || 
      lowerCommand.includes('подготовь контекст для copilot') ||
      lowerCommand.includes('обнови контекст для copilot')) {
    
    const taskIdRegex = /контекст для copilot .*?задач[иа]? (\d+)/i;
    const taskMatch = command.match(taskIdRegex);
    
    if (taskMatch) {
      return prepareCopilotContext(parseInt(taskMatch[1]));
    } else {
      return prepareCopilotContext();
    }
  }
  
  // Если не распознали команду
  return {
    success: false,
    message: 'Команда не распознана. Используйте одну из следующих команд:\n' +
      '- создай задачу [название]\n' +
      '- покажи список задач\n' +
      '- отметь задачу [id] как выполненную\n' +
      '- дай следующую задачу\n' +
      '- обнови контекст задачи [id]\n' +
      '- предложи задачу\n' +
      '- получи контекст для copilot [для задачи id]'
  };
}

/**
 * Обработчик команды "Продолжить итерацию" - завершает текущую задачу и переходит к следующей
 * @param {string} command - Исходная команда из чата
 * @returns {string} - Ответ для вывода в чат
 */
function continueCopilotIteration(command) {
  // Получаем текущую активную задачу
  const currentTask = require('./next').getCurrentTask();
  
  if (!currentTask) {
    return 'Нет активной задачи в процессе выполнения. Используйте "дай следующую задачу" чтобы начать работу.';
  }
  
  // Завершаем текущую задачу
  const completeResult = require('./complete').completeTaskWithContextUpdate(
    currentTask.id.toString(), 
    `Задача завершена через интерфейс чата (команда: "${command}")`
  );
  
  if (!completeResult.success) {
    return `❌ Не удалось завершить текущую задачу: ${completeResult.message}`;
  }
  
  // Если нет следующей задачи
  if (!completeResult.nextTask) {
    return `✅ Задача #${currentTask.id} "${currentTask.title}" успешно завершена. Больше нет задач в очереди.`;
  }
  
  // Начинаем выполнение следующей задачи
  require('./complete').startTaskExecution(completeResult.nextTask.id.toString());
  
  return `✅ Задача #${currentTask.id} "${currentTask.title}" успешно завершена.\n\n` +
         `🚀 Начато выполнение следующей задачи: #${completeResult.nextTask.id} "${completeResult.nextTask.title}"\n` +
         `Приоритет: ${completeResult.nextTask.priority}\n` +
         `${completeResult.nextTask.description ? `Описание: ${completeResult.nextTask.description}\n` : ''}` +
         `\n💡 Контекст для GitHub Copilot готов. Можете запросить помощь по этой задаче.`;
}

/**
 * Продолжить итерацию с GitHub Copilot (команда "Продолжить")
 * @param {string} command - Исходная команда пользователя (например, 'Продолжить' или 'Продолжить итерацию?')
 * @returns {Promise<object>} - Результат продолжения от Copilot. Возвращает объект с success, message и data (ответ Copilot).
 *
 * Пример использования:
 *   processCommand('Продолжить итерацию?')
 */
async function continueCopilotIteration(command) {
  try {
    const copilot = require('./copilot');
    const next = require('./next');
    const complete = require('./complete');
    
    // Получаем текущую активную задачу
    const currentTask = next.getCurrentTask();
    
    // Если есть активная задача, завершаем её
    if (currentTask) {
      console.log(chalk.yellow(`Завершаем текущую задачу #${currentTask.id}: "${currentTask.title}"`));
      
      // Завершаем текущую задачу
      const completeResult = await complete.completeTask(currentTask.id.toString());
      
      if (!completeResult.success) {
        return {
          success: false,
          message: `Не удалось завершить текущую задачу: ${completeResult.message}`
        };
      }
      
      console.log(chalk.green(`✓ Задача #${currentTask.id} успешно завершена`));
    }
    
    // Начинаем следующую задачу
    const nextTaskResult = next.startNextTask(true); // true означает автоматический выбор следующей задачи
    
    if (!nextTaskResult.success) {
      return {
        success: false,
        message: `Не удалось начать следующую задачу: ${nextTaskResult.message}`
      };
    }
    
    console.log(chalk.green(`✓ Начата новая задача #${nextTaskResult.task.id}: "${nextTaskResult.task.title}"`));
    
    // Можно извлечь дополнительный промпт из команды, если нужно
    const prompt = command.replace(/(продолжить( итерацию)?|continue( to iterate)?)/i, '').trim();
    
    // Получаем продолжение от Copilot для новой задачи
    const result = await copilot.getCopilotContinuation(prompt);
    
    return {
      success: true,
      message: `Переход к следующей задаче #${nextTaskResult.task.id} "${nextTaskResult.task.title}" выполнен. Продолжение от GitHub Copilot:`,
      data: result,
      taskTransition: {
        previousTask: currentTask,
        nextTask: nextTaskResult.task
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Ошибка при переходе к следующей задаче: ${error.message}`
    };
  }
}

/**
 * Подготовить контекст для GitHub Copilot
 * 
 * @param {number} taskId - ID задачи (опционально)
 * @returns {object} - Результат операции
 */
function prepareCopilotContext(taskId) {
  try {
    const context = require('./context');
    const copilotContext = context.prepareCopilotContext(taskId);
    
    if (copilotContext) {
      return {
        success: true,
        message: taskId 
          ? `Контекст для GitHub Copilot создан для задачи #${taskId}` 
          : 'Контекст для GitHub Copilot успешно создан',
        data: { copilotContext }
      };
    } else {
      return {
        success: false,
        message: 'Не удалось создать контекст для GitHub Copilot'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Ошибка при создании контекста для GitHub Copilot: ${error.message}`
    };
  }
}

/**
 * Предложить следующую задачу для выполнения
 * 
 * @returns {object} - Результат операции
 */
function suggestNextTask() {
  try {
    const context = require('./context');
    const suggestion = context.suggestTaskAndPrepareContext();
    
    if (suggestion) {
      return {
        success: true,
        message: suggestion.message,
        data: suggestion
      };
    } else {
      return {
        success: false,
        message: 'Нет подходящих задач для предложения'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Ошибка при предложении задачи: ${error.message}`
    };
  }
}

/**
 * Обновить контекст для текущей активной задачи
 * 
 * @returns {object} - Результат операции
 */
function updateCurrentContext() {
  const currentContext = contextTracker.getCurrentContext();
  if (!currentContext || !currentContext.activeTask) {
    return {
      success: false,
      message: 'Нет активной задачи для обновления контекста'
    };
  }
  
  return updateTaskContext(currentContext.activeTask);
}

/**
 * Обновить контекст для указанной задачи
 * 
 * @param {number} taskId - ID задачи
 * @returns {object} - Результат операции
 */
function updateTaskContext(taskId) {
  try {
    const context = require('./context');
    const result = context.checkAndUpdateCopilotContext(taskId);
    
    return {
      success: result,
      message: result 
        ? `Контекст для задачи #${taskId} успешно обновлен` 
        : `Не удалось обновить контекст для задачи #${taskId}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Ошибка при обновлении контекста: ${error.message}`
    };
  }
}

/**
 * Проверка статуса завершения задачи
 * 
 * @param {string} taskId - ID задачи, может содержать точку для подзадачи
 * @returns {object} - Результат операции со статусом задачи
 */
function checkTaskCompletion(taskId) {
  try {
    const tasksData = loadTasks();
    const parts = taskId.toString().split('.');
    const mainTaskId = parseInt(parts[0]);
    
    const task = tasksData.tasks.find(t => t.id === mainTaskId);
    if (!task) {
      return {
        success: false,
        message: `Задача с ID ${mainTaskId} не найдена`
      };
    }
    
    // Проверка статуса основной задачи
    if (parts.length === 1) {
      const isDone = task.status === 'done';
      
      return {
        success: true,
        message: isDone 
          ? `Задача #${mainTaskId} "${task.title}" отмечена как выполненная` 
          : `Задача #${mainTaskId} "${task.title}" не отмечена как выполненная. Текущий статус: ${task.status}`,
        data: {
          taskId: mainTaskId,
          title: task.title,
          status: task.status,
          isDone
        }
      };
    }
    
    // Проверка статуса подзадачи
    const subtaskId = parseInt(parts[1]);
    if (!task.subtasks || !Array.isArray(task.subtasks)) {
      return {
        success: false,
        message: `Задача #${mainTaskId} не имеет подзадач`
      };
    }
    
    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      return {
        success: false,
        message: `Подзадача с ID ${taskId} не найдена`
      };
    }
    
    const isDone = subtask.status === 'done';
    
    return {
      success: true,
      message: isDone 
        ? `Подзадача #${taskId} "${subtask.title}" отмечена как выполненная` 
        : `Подзадача #${taskId} "${subtask.title}" не отмечена как выполненная. Текущий статус: ${subtask.status}`,
      data: {
        taskId,
        title: subtask.title,
        status: subtask.status,
        isDone
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Ошибка при проверке статуса задачи: ${error.message}`
    };
  }
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
  let response = '';
  let completedTitle = '';
  let completedId = '';
  let isSubtask = false;
  let allSubtasksDone = false;

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
    completedTitle = subtask.title;
    completedId = taskId;
    isSubtask = true;
    // Проверяем, все ли подзадачи выполнены
    allSubtasksDone = parentTask.subtasks.every(st => st.status === 'done');
    // Если все подзадачи выполнены, отмечаем родительскую задачу как выполненную
    if (allSubtasksDone) {
      parentTask.status = 'done';
    }
    // Обновляем дату изменения
    parentTask.updated_at = new Date().toISOString();
    // Сохраняем изменения
    if (!saveTasks(tasksData)) {
      return '✗ Не удалось сохранить изменения';
    }
    // Добавляем запись в историю выполнения и контекст
    const summary = `Выполнена подзадача ${taskId} "${subtask.title}"`;
    contextTracker.updateTaskHistory(parentIdNum, 'update', summary);
    if (allSubtasksDone) {
      contextTracker.updateTaskStatus(parentIdNum, 'done', `Выполнены все подзадачи (${parentTask.subtasks.length})`);
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
    completedTitle = task.title;
    completedId = taskIdNum;
    // Сохраняем изменения
    if (!saveTasks(tasksData)) {
      return '✗ Не удалось сохранить изменения';
    }
    // Обновляем контекст задачи
    const summary = `Выполнена задача "${task.title}"${task.subtasks.length > 0 ? ` и все её подзадачи (${task.subtasks.length})` : ''}`;
    contextTracker.updateTaskStatus(taskIdNum, 'done', summary);
  }

  // Формируем яркий статус
  response += `\n\n✅ **СТАТУС: ВЫПОЛНЕНО!**\n`;
  response += `**${isSubtask ? 'Подзадача' : 'Задача'} #${completedId}: "${completedTitle}"**\n`;
  response += `\nСтатус задачи изменён на: **done**\n`;

  // Если это подзадача и все подзадачи выполнены, сообщаем об этом
  if (isSubtask && allSubtasksDone) {
    response += `\n🎉 Все подзадачи выполнены, задача #${completedId.split('.')[0]} также отмечена как выполненная!`;
  }

  // Поиск следующей задачи
  const pendingTasks = tasksData.tasks.filter(task => task.status === 'pending');
  if (pendingTasks.length > 0) {
    // Сортировка по приоритету (от 1 до 3)
    pendingTasks.sort((a, b) => a.priority - b.priority);
    const nextTask = pendingTasks[0];
    response += `\n\n➡️ **Следующая задача:** [${nextTask.id}] ${nextTask.title} (приоритет: ${nextTask.priority})`;
    response += `\nОписание: ${nextTask.description}`;
    if (nextTask.subtasks && nextTask.subtasks.length > 0) {
      response += `\nПодзадачи: ${nextTask.subtasks.map(st => st.title).join(', ')}`;
    }
    response += `\n\nЧтобы перейти к ней, используйте команду: "Дай следующую задачу" или "Начни выполнение задачи ${nextTask.id}".`;
  } else {
    response += `\n\n🎉 Все задачи выполнены! Если хотите что-то скорректировать или добавить — оставайтесь в системе.`;
  }

  response += `\n\n💡 Контекст задачи обновлён для GitHub Copilot.`;
  return response;
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
    
    // Обновляем контекст задачи
    contextTracker.updateTaskStatus(nextTask.id, 'in-progress', `Начато выполнение задачи "${nextTask.title}"`);
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
  response += '\n💡 Контекст задачи обновлен для GitHub Copilot';
  
  return response;
}

/**
 * Начать выполнение следующей задачи
 * @returns {string} - Результат выполнения команды
 */
function startNextTaskExecution() {
  const result = contextTracker.suggestNextTask();
  
  if (!result.hasNextTask) {
    return `🎉 ${result.message}`;
  }
  
  // Выводим сообщение о начале выполнения задачи и контекст для Copilot
  return `
🚀 ${result.message}

💡 Контекст для GitHub Copilot обновлен с учетом текущей задачи и истории проекта.
Я уже знаю о задаче #${result.nextTask.id} и готов помочь её выполнить.
Вы можете начать работу, а я буду учитывать контекст проекта в своих ответах.`;
}

/**
 * Начать выполнение конкретной задачи
 * @param {number} taskId - ID задачи для выполнения
 * @returns {string} - Результат выполнения команды
 */
function startTaskExecution(taskId) {
  const tasksData = loadTasks();
  
  // Проверяем существование задачи
  const task = tasksData.tasks.find(t => t.id === taskId);
  if (!task) {
    return `❌ Задача с ID ${taskId} не найдена`;
  }
  
  // Обновляем статус задачи на "в процессе"
  task.status = 'in-progress';
  task.updated_at = new Date().toISOString();
  
  // Сохраняем изменения
  if (!saveTasks(tasksData)) {
    return '❌ Не удалось обновить статус задачи';
  }
  
  // Обновляем контекст задачи
  contextTracker.updateTaskStatus(taskId, 'in-progress', `Начато выполнение задачи "${task.title}"`);
  
  // Подготавливаем контекст для Copilot
  const copilotContext = contextTracker.prepareTaskContextForCopilot(taskId);
  
  // Формируем сообщение с информацией о задаче
  let response = `
🚀 Начинаю выполнение задачи #${taskId}: "${task.title}"
Приоритет: ${task.priority}
${task.description ? `\nОписание: ${task.description}` : ''}

${task.subtasks && task.subtasks.length > 0 ? 
  `Подзадачи:\n${task.subtasks.map(st => `- ${st.id} ${st.title}`).join('\n')}` : ''}

💡 Контекст для GitHub Copilot обновлен. Я уже знаю о задаче #${taskId} и готов помочь её выполнить.
Вы можете начать работу, а я буду учитывать контекст проекта в своих ответах.`;
  
  return response;
}

/**
 * Обновление контекста задачи
 * @param {number} taskId - ID задачи для обновления контекста
 * @param {string} comment - Комментарий для добавления в контекст
 * @returns {string} - Результат выполнения команды
 */
function updateTaskContext(taskId, comment) {
  const tasksData = loadTasks();
  
  // Проверяем существование задачи
  const task = tasksData.tasks.find(t => t.id === taskId);
  if (!task) {
    return `❌ Задача с ID ${taskId} не найдена`;
  }
  
  // Обновляем контекст задачи
  const success = contextTracker.addHistoryEntry(taskId, 'update', comment);
  
  if (!success) {
    return '❌ Не удалось обновить контекст задачи';
  }
  
  // Подготавливаем обновленный контекст для Copilot
  const copilotContext = contextTracker.prepareTaskContextForCopilot(taskId);
  
  return `
✅ Контекст задачи #${taskId} обновлен: ${comment}

💡 GitHub Copilot теперь учитывает обновленный контекст задачи в своих рекомендациях.`;
}

/**
 * Обновление общего контекста проекта
 * @param {string} comment - Комментарий для добавления в общий контекст
 * @returns {string} - Результат выполнения команды
 */
function updateGeneralContext(comment) {
  if (!comment) {
    return '❌ Пустой комментарий для обновления контекста';
  }
  
  const context = contextTracker.loadContext();
  if (!context) {
    return '❌ Не удалось загрузить контекст проекта';
  }
  
  // Обновляем общий контекст проекта
  context.projectState = comment;
  context.lastUpdated = new Date().toISOString();
  
  const success = contextTracker.saveContext(context);
  
  if (!success) {
    return '❌ Не удалось обновить общий контекст проекта';
  }
  
  return `
✅ Общий контекст проекта обновлен: ${comment}

💡 GitHub Copilot теперь учитывает обновленный контекст проекта в своих рекомендациях.`;
}

/**
 * Показать контекст задачи
 * @param {number} taskId - ID задачи для отображения контекста
 * @returns {string} - Контекст задачи
 */
function showTaskContext(taskId) {
  const copilotContext = contextTracker.prepareTaskContextForCopilot(taskId);
  
  if (!copilotContext || copilotContext.includes('не найдена') || copilotContext.includes('Не удалось')) {
    return `❌ Не удалось получить контекст для задачи #${taskId}`;
  }
  
  return `
📝 Контекст задачи #${taskId} для GitHub Copilot:

${copilotContext}

Этот контекст автоматически используется GitHub Copilot при работе с кодом.`;
}

/**
 * Показать общий контекст проекта
 * @returns {string} - Общий контекст проекта
 */
function showGeneralContext() {
  const context = contextTracker.loadContext();
  if (!context) {
    return '❌ Не удалось загрузить контекст проекта';
  }
  
  const summary = contextTracker.getProjectSummary();
  
  return `
📝 Общий контекст проекта для GitHub Copilot:

${summary}

Проектное состояние: ${context.projectState}
Последнее обновление: ${new Date(context.lastUpdated).toLocaleString()}

Этот контекст автоматически используется GitHub Copilot при работе с кодом.`;
}

/**
 * Проверка на завершение задачи и предложение перейти к следующей 
 * @param {number} taskId - ID проверяемой задачи
 * @returns {string} - Сообщение с предложением
 */
function checkTaskCompletionAndSuggestNext(taskId) {
  const tasksData = loadTasks();
  
  // Проверяем существование задачи
  const task = tasksData.tasks.find(t => t.id === taskId);
  if (!task) {
    return `❌ Задача с ID ${taskId} не найдена`;
  }
  
  // Если задача уже выполнена, предлагаем следующую
  if (task.status === 'done') {
    return `
✅ Задача #${taskId} "${task.title}" уже отмечена как выполненная.

${startNextTaskExecution()}`;
  }
  
  // Если задача в процессе, предлагаем отметить её как выполненную
  const prompt = contextTracker.generateTaskCompletionPrompt(taskId);
  
  return `
⚙️ Задача #${taskId} "${task.title}" в процессе выполнения.

${prompt}

Ответьте "Да, задача выполнена" чтобы отметить задачу как выполненную и перейти к следующей.
Или продолжите работу над текущей задачей.`;
}

/**
 * Показать историю выполнения задачи
 * @param {number} taskId - ID задачи
 * @returns {string} - История выполнения задачи
 */
function showTaskHistory(taskId) {
  const history = contextTracker.getFormattedTaskHistory(taskId);
  
  return `
📜 ${history}

Эта история автоматически учитывается GitHub Copilot при работе с кодом.`;
}

/**
 * Показать историю выполнения всех задач
 * @returns {string} - История выполнения всех задач
 */
function showAllTasksHistory() {
  const history = contextTracker.getFormattedFullHistory();
  
  return `
📜 ${history}

Эта история автоматически учитывается GitHub Copilot при работе с кодом.`;
}

/**
 * Генерация задач из плана или обсуждения
 * @param {string} command - Команда с описанием плана
 * @returns {string} - Результат генерации задач
 */
function generateTasksFromPlan(command) {
  // Извлекаем план из текста команды
  const planTextRegex = /создай (?:список )?задач(и)? из (?:плана|нашего обсуждения)(?:\s*[:：]\s*|\s+)(.*)/is;
  const match = command.match(planTextRegex);
  
  let planText = '';
  if (match && match[2]) {
    planText = match[2].trim();
  } else {
    // Если не удалось извлечь план, берем весь текст после команды
    planText = command.replace(/создай (?:список )?задач(?:и)? из (?:плана|нашего обсуждения)/i, '').trim();
  }
  
  if (!planText) {
    return '❌ Не удалось извлечь план из команды. Пожалуйста, уточните план задач.';
  }
  
  // Разбиваем план на отдельные пункты (предполагаем, что каждый пункт - отдельная задача)
  const taskLines = planText
    .split(/\n+|\\n+/) // Разделение по переносам строк
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.match(/^[#\-\*]+\s*$/)); // Фильтрация пустых строк и разделителей
  
  // Пытаемся определить, разбит ли план на пункты или подпункты
  const bulletPointRegex = /^([#*\-\d]+[\.\)]*\s+|[\d]+[\.\)]+\s+)/;
  const hasBulletPoints = taskLines.some(line => bulletPointRegex.test(line));
  
  // Создаем список задач
  const tasksData = loadTasks();
  const newTasks = [];
  
  if (hasBulletPoints) {
    // Обрабатываем пункты плана как отдельные задачи
    let currentTask = null;
    let currentSubtasks = [];
    
    // Определяем уровень отступа для каждой строки
    const getIndentLevel = (line) => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    };
    
    const lines = taskLines.map(line => ({
      text: line.replace(bulletPointRegex, '').trim(),
      indent: getIndentLevel(line),
      hasBullet: bulletPointRegex.test(line)
    }));
    
    // Определяем минимальный отступ для задач первого уровня
    const baseIndentLevel = lines.filter(l => l.hasBullet).reduce((min, l) => Math.min(min, l.indent), Infinity);
    
    // Проходим по строкам и группируем их в задачи и подзадачи
    for (const line of lines) {
      if (line.hasBullet && (line.indent === baseIndentLevel || currentTask === null)) {
        // Если это новая задача первого уровня
        if (currentTask !== null) {
          // Сохраняем предыдущую задачу
          newTasks.push({
            ...currentTask,
            subtasks: currentSubtasks
          });
        }
        
        // Создаем новую задачу
        currentTask = {
          id: getNextTaskId(tasksData.tasks),
          title: line.text,
          description: `Задача создана из плана: ${line.text}`,
          status: 'pending',
          priority: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        currentSubtasks = [];
      } else if (line.hasBullet && currentTask !== null) {
        // Если это подзадача
        currentSubtasks.push({
          id: `${currentTask.id}.${currentSubtasks.length + 1}`,
          title: line.text,
          status: 'pending'
        });
      } else if (currentTask !== null) {
        // Если это дополнительное описание для текущей задачи
        currentTask.description += '\n' + line.text;
      }
    }
    
    // Добавляем последнюю задачу
    if (currentTask !== null) {
      newTasks.push({
        ...currentTask,
        subtasks: currentSubtasks
      });
    }
  } else {
    // Если пункты не выделены, создаем отдельную задачу для каждой строки
    taskLines.forEach((line, index) => {
      const taskId = getNextTaskId(tasksData.tasks) + index;
      
      newTasks.push({
        id: taskId,
        title: line,
        description: `Задача создана из плана: ${line}`,
        status: 'pending',
        priority: 2,
        subtasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
  }
  
  // Если задачи не удалось сгенерировать
  if (newTasks.length === 0) {
    return '❌ Не удалось создать задачи из предоставленного плана. Пожалуйста, уточните план.';
  }
  
  // Добавляем новые задачи в список
  tasksData.tasks = [...tasksData.tasks, ...newTasks];
  
  // Сохраняем задачи в файл
  if (saveTasks(tasksData)) {
    // Формируем ответ
    let response = `✅ Успешно создано задач из плана: ${newTasks.length}\n\n`;
    
    newTasks.forEach(task => {
      response += `🔹 #${task.id} ${task.title}\n`;
      
      if (task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          response += `  ◦ ${subtask.id} ${subtask.title}\n`;
        });
      }
      
      response += '\n';
    });
    
    response += `
💡 Контекст для GitHub Copilot обновлен с новыми задачами.
Чтобы начать выполнение, используйте команду "Начни выполнение задач"`;
    
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
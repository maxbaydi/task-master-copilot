#!/usr/bin/env node

/**
 * Скрипт для отслеживания контекста выполнения задач
 * Позволяет хранить и обновлять историю работы над задачами
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Определяем пути в зависимости от режима (локальный или глобальный)
const isGlobalMode = process.env.TASK_MASTER_MODE === 'global';
const tasksDir = process.env.TASK_MASTER_DIR || path.join(process.cwd(), 'tasks');
const tasksFile = process.env.TASK_MASTER_FILE || path.join(tasksDir, 'tasks.json');
const contextFile = path.join(tasksDir, 'context.json');

/**
 * Инициализировать контекст, если файл не существует
 */
function initContext() {
  if (!fs.existsSync(contextFile)) {
    const initialContext = {
      lastUpdated: new Date().toISOString(),
      projectState: "Инициализация проекта",
      taskHistory: [],
      currentContext: {
        activeTask: null,
        summary: "Проект был инициализирован"
      }
    };
    
    try {
      fs.writeFileSync(contextFile, JSON.stringify(initialContext, null, 2));
      console.log(chalk.green(`✓ Создан файл контекста в ${contextFile}`));
      return initialContext;
    } catch (error) {
      console.error(chalk.red(`✗ Ошибка при создании файла контекста: ${error.message}`));
      return null;
    }
  }
  
  return loadContext();
}

/**
 * Загрузить текущий контекст
 */
function loadContext() {
  try {
    if (!fs.existsSync(contextFile)) {
      return initContext();
    }
    
    const data = fs.readFileSync(contextFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red(`✗ Ошибка при чтении файла контекста: ${error.message}`));
    return null;
  }
}

/**
 * Загрузить текущие задачи
 */
function loadTasks() {
  try {
    if (!fs.existsSync(tasksFile)) {
      console.error(chalk.red(`✗ Файл задач не найден: ${tasksFile}`));
      return null;
    }
    
    const data = fs.readFileSync(tasksFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red(`✗ Ошибка при чтении файла задач: ${error.message}`));
    return null;
  }
}

/**
 * Добавить запись в историю выполнения задач
 * 
 * @param {number} taskId - ID задачи
 * @param {string} action - Действие (start, complete, update)
 * @param {string} summary - Краткое описание выполненной работы
 * @param {object} details - Дополнительные детали (опционально)
 * @returns {boolean} - Успешность операции
 */
function addHistoryEntry(taskId, action, summary, details = {}) {
  const context = loadContext();
  if (!context) return false;
  
  const tasks = loadTasks();
  if (!tasks) return false;
  
  // Найти задачу по ID
  const task = tasks.tasks.find(t => t.id === taskId);
  if (!task) {
    console.error(chalk.red(`✗ Задача с ID ${taskId} не найдена`));
    return false;
  }
  
  // Создать запись в истории
  const historyEntry = {
    taskId,
    taskTitle: task.title,
    action,
    summary,
    timestamp: new Date().toISOString(),
    details
  };
  
  // Добавить запись в историю
  context.taskHistory.push(historyEntry);
  
  // Обновить текущий контекст
  context.lastUpdated = new Date().toISOString();
  if (action === 'start') {
    context.currentContext.activeTask = taskId;
  } else if (action === 'complete') {
    context.currentContext.activeTask = null;
  }
  context.currentContext.summary = summary;
  
  // Сохранить обновленный контекст
  return saveContext(context);
}

/**
 * Получить текущий активный контекст
 * 
 * @returns {object|null} - Текущий контекст или null в случае ошибки
 */
function getCurrentContext() {
  const context = loadContext();
  return context ? context.currentContext : null;
}

/**
 * Получить историю выполнения задачи
 * 
 * @param {number} taskId - ID задачи
 * @returns {array|null} - История выполнения задачи или null в случае ошибки
 */
function getTaskHistory(taskId) {
  const context = loadContext();
  if (!context) return null;
  
  return context.taskHistory.filter(entry => entry.taskId === taskId);
}

/**
 * Получить полную историю выполнения всех задач
 * 
 * @returns {array|null} - История выполнения всех задач или null в случае ошибки
 */
function getAllHistory() {
  const context = loadContext();
  return context ? context.taskHistory : null;
}

/**
 * Сохранить контекст в файл
 * 
 * @param {object} context - Объект контекста
 * @returns {boolean} - Успешность операции
 */
function saveContext(context) {
  try {
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2));
    return true;
  } catch (error) {
    console.error(chalk.red(`✗ Ошибка при сохранении файла контекста: ${error.message}`));
    return false;
  }
}

/**
 * Обновить статус задачи и контекст
 * 
 * @param {number} taskId - ID задачи
 * @param {string} status - Новый статус (pending, in-progress, done, deferred)
 * @param {string} summary - Краткое описание изменений
 * @returns {boolean} - Успешность операции
 */
function updateTaskStatus(taskId, status, summary) {
  const tasks = loadTasks();
  if (!tasks) return false;
  
  // Найти задачу по ID
  const taskIndex = tasks.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    console.error(chalk.red(`✗ Задача с ID ${taskId} не найдена`));
    return false;
  }
  
  // Обновить статус задачи
  const oldStatus = tasks.tasks[taskIndex].status;
  tasks.tasks[taskIndex].status = status;
  tasks.tasks[taskIndex].updated_at = new Date().toISOString();
  
  // Сохранить обновленные задачи
  try {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
    
    // Определить действие для истории
    let action = 'update';
    if (status === 'in-progress' && oldStatus !== 'in-progress') {
      action = 'start';
    } else if (status === 'done' && oldStatus !== 'done') {
      action = 'complete';
    }
    
    // Добавить запись в историю
    return addHistoryEntry(taskId, action, summary, { oldStatus, newStatus: status });
    
  } catch (error) {
    console.error(chalk.red(`✗ Ошибка при сохранении файла задач: ${error.message}`));
    return false;
  }
}

/**
 * Получить следующую задачу для выполнения на основе приоритета
 * 
 * @returns {object|null} - Следующая задача или null, если нет задач
 */
function getNextTask() {
  const tasks = loadTasks();
  if (!tasks || !tasks.tasks || tasks.tasks.length === 0) return null;
  
  // Получить следующую задачу в статусе pending с наивысшим приоритетом
  const pendingTasks = tasks.tasks.filter(task => task.status === 'pending');
  
  if (pendingTasks.length === 0) return null;
  
  // Сортировка по приоритету (от 1 до 3)
  pendingTasks.sort((a, b) => a.priority - b.priority);
  
  return pendingTasks[0];
}

/**
 * Получить краткий отчет о текущем состоянии проекта
 * 
 * @returns {string} - Отчет о состоянии проекта
 */
function getProjectSummary() {
  const tasks = loadTasks();
  if (!tasks) return "Не удалось загрузить информацию о задачах";
  
  const context = loadContext();
  if (!context) return "Не удалось загрузить контекст проекта";
  
  const total = tasks.tasks.length;
  const completed = tasks.tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.tasks.filter(t => t.status === 'in-progress').length;
  const pending = tasks.tasks.filter(t => t.status === 'pending').length;
  
  const activeTaskId = context.currentContext.activeTask;
  let activeTaskInfo = "Нет активной задачи";
  
  if (activeTaskId) {
    const activeTask = tasks.tasks.find(t => t.id === activeTaskId);
    if (activeTask) {
      activeTaskInfo = `Активная задача: #${activeTaskId} ${activeTask.title}`;
    }
  }
  
  return `
Текущее состояние проекта: ${tasks.project} (v${tasks.version})

Общий прогресс: ${completed}/${total} задач выполнено (${Math.round(completed/total*100)}%)
- Выполнено: ${completed}
- В процессе: ${inProgress}
- Ожидает: ${pending}

${activeTaskInfo}

Последнее обновление контекста: ${new Date(context.lastUpdated).toLocaleString()}
Последняя активность: ${context.currentContext.summary}
`;
}

/**
 * Получить форматированную историю задачи для отображения
 * 
 * @param {number} taskId - ID задачи
 * @returns {string} - Форматированная история задачи
 */
function getFormattedTaskHistory(taskId) {
  const tasks = loadTasks();
  if (!tasks) return "Не удалось загрузить информацию о задачах";
  
  const task = tasks.tasks.find(t => t.id === taskId);
  if (!task) return `Задача с ID ${taskId} не найдена`;
  
  const history = getTaskHistory(taskId);
  if (!history || history.length === 0) return `Для задачи #${taskId} нет истории выполнения`;
  
  let result = `История выполнения задачи #${taskId}: ${task.title}\n\n`;
  
  history.forEach((entry, index) => {
    const date = new Date(entry.timestamp).toLocaleString();
    let actionText = '';
    
    switch (entry.action) {
      case 'start':
        actionText = '🚀 Начало выполнения';
        break;
      case 'update':
        actionText = '📝 Обновление';
        break;
      case 'complete':
        actionText = '✅ Завершение';
        break;
      default:
        actionText = entry.action;
    }
    
    result += `${index + 1}. ${actionText} (${date})\n`;
    result += `   ${entry.summary}\n\n`;
  });
  
  return result;
}

/**
 * Получить форматированную полную историю для отображения
 * 
 * @returns {string} - Форматированная полная история
 */
function getFormattedFullHistory() {
  const history = getAllHistory();
  if (!history || history.length === 0) return "История выполнения задач пуста";
  
  let result = "Полная история выполнения задач:\n\n";
  
  // Группируем историю по ID задач для лучшей читаемости
  const taskGroups = {};
  history.forEach(entry => {
    if (!taskGroups[entry.taskId]) {
      taskGroups[entry.taskId] = [];
    }
    taskGroups[entry.taskId].push(entry);
  });
  
  // Выводим историю по группам
  Object.keys(taskGroups).forEach(taskId => {
    const entries = taskGroups[taskId];
    const taskTitle = entries[0].taskTitle;
    
    result += `Задача #${taskId}: ${taskTitle}\n`;
    
    entries.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleString();
      let actionText = '';
      
      switch (entry.action) {
        case 'start':
          actionText = '🚀 Начало выполнения';
          break;
        case 'update':
          actionText = '📝 Обновление';
          break;
        case 'complete':
          actionText = '✅ Завершение';
          break;
        default:
          actionText = entry.action;
      }
      
      result += `   ${actionText} (${date}): ${entry.summary}\n`;
    });
    
    result += '\n';
  });
  
  return result;
}

/**
 * Подготовить контекст задачи для GitHub Copilot
 * Создает специально форматированный контекст для использования в GitHub Copilot
 * 
 * @param {number} taskId - ID задачи
 * @returns {string} - Контекст для GitHub Copilot
 */
function prepareTaskContextForCopilot(taskId) {
  const tasks = loadTasks();
  if (!tasks) return null;
  
  const task = tasks.tasks.find(t => t.id === parseInt(taskId));
  if (!task) return null;
  
  // Получаем историю задачи
  const history = getTaskHistory(taskId);
  
  // Создаем контекст для GitHub Copilot
  let copilotContext = `
<task-context>
Текущая задача: #${task.id} ${task.title}
Статус: ${task.status === 'in-progress' ? 'В процессе выполнения' : task.status}
Приоритет: ${task.priority}
Описание: ${task.description || 'Нет описания'}

${task.subtasks && task.subtasks.length > 0 ? `Подзадачи:
${task.subtasks.map(st => `- [${st.status === 'done' ? 'x' : ' '}] ${st.id} ${st.title}`).join('\n')}
` : ''}

${history && history.length > 0 ? `История выполнения:
${history.map(entry => `${new Date(entry.timestamp).toLocaleString()}: ${entry.summary}`).join('\n')}
` : 'История выполнения отсутствует.'}
</task-context>
`;

  // Сохраняем контекст в файл для использования GitHub Copilot
  const copilotContextFile = path.join(tasksDir, 'copilot-context.md');
  try {
    fs.writeFileSync(copilotContextFile, copilotContext);
  } catch (error) {
    console.error(chalk.red(`✗ Ошибка при сохранении контекста для GitHub Copilot: ${error.message}`));
  }
  
  return copilotContext;
}

/**
 * Обновить контекст после завершения задачи
 * 
 * @param {number} taskId - ID завершенной задачи
 * @param {string} summary - Краткое описание результата выполнения
 * @returns {object} - Результат обновления контекста и информация о следующей задаче
 */
function updateContextAfterTaskCompletion(taskId, summary) {
  // Обновляем контекст задачи
  const context = loadContext();
  if (!context) {
    return { success: false, message: 'Не удалось загрузить контекст' };
  }
  
  // Обновляем текущий контекст
  context.lastUpdated = new Date().toISOString();
  context.currentContext.activeTask = null;
  context.currentContext.summary = summary || `Задача #${taskId} завершена`;
  
  // Сохраняем контекст
  const saveSuccess = saveContext(context);
  
  // Получаем следующую задачу
  const nextTask = getNextTask();
  
  // Если есть следующая задача, подготавливаем её контекст для GitHub Copilot
  let copilotContext = null;
  if (nextTask) {
    copilotContext = prepareTaskContextForCopilot(nextTask.id);
  }
  
  return {
    success: saveSuccess,
    message: saveSuccess ? 'Контекст успешно обновлен' : 'Не удалось обновить контекст',
    nextTask,
    copilotContext
  };
}

/**
 * Проверить, нужно ли обновить контекст для GitHub Copilot перед выполнением пункта
 * Вызывается перед началом выполнения каждого пункта задачи
 * 
 * @param {number} taskId - ID задачи или подзадачи
 * @returns {boolean} - Нужно ли обновить контекст
 */
function checkContextBeforeTaskExecution(taskId) {
  const context = loadContext();
  if (!context) return true; // Если контекст не загружен, нужно обновить
  
  // Проверяем, является ли указанная задача текущей активной задачей
  if (context.currentContext.activeTask !== parseInt(taskId.toString().split('.')[0])) {
    return true; // Если текущая активная задача отличается, нужно обновить контекст
  }
  
  // Проверяем, когда последний раз обновлялся контекст
  const lastUpdated = new Date(context.lastUpdated);
  const now = new Date();
  const hoursSinceLastUpdate = (now - lastUpdated) / (1000 * 60 * 60);
  
  // Если прошло более 1 часа с последнего обновления, нужно обновить контекст
  return hoursSinceLastUpdate > 1;
}

/**
 * Предложить выполнение задачи
 * Используется для проактивного предложения выполнить задачу
 * 
 * @returns {object} - Информация о предложенной задаче
 */
function suggestTaskExecution() {
  // Проверяем, есть ли активная задача
  const context = loadContext();
  if (!context) return null;
  
  if (context.currentContext.activeTask) {
    // Если есть активная задача, предлагаем продолжить её
    const tasks = loadTasks();
    if (!tasks) return null;
    
    const activeTask = tasks.tasks.find(t => t.id === context.currentContext.activeTask);
    if (!activeTask) return null;
    
    return {
      taskId: activeTask.id,
      title: activeTask.title,
      type: 'continue',
      message: `Продолжить выполнение активной задачи #${activeTask.id} "${activeTask.title}"?`
    };
  } else {
    // Если нет активной задачи, предлагаем начать следующую
    const nextTask = getNextTask();
    if (!nextTask) return null;
    
    return {
      taskId: nextTask.id,
      title: nextTask.title,
      type: 'start',
      message: `Начать выполнение задачи #${nextTask.id} "${nextTask.title}"?`
    };
  }
}

// Экспорт функций
module.exports = {
  initContext,
  addHistoryEntry,
  updateTaskStatus,
  getCurrentContext,
  getTaskHistory,
  getAllHistory,
  getNextTask,
  getProjectSummary,
  getFormattedTaskHistory,
  getFormattedFullHistory,
  prepareTaskContextForCopilot,
  updateContextAfterTaskCompletion,
  checkContextBeforeTaskExecution,
  suggestTaskExecution
};
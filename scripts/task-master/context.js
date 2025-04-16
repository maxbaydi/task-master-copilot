#!/usr/bin/env node

/**
 * Скрипт для работы с контекстом задач
 * Позволяет просматривать историю выполнения задач и текущий контекст
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const contextTracker = require('./context-tracker');
const copilot = require('./copilot');

/**
 * Загрузить данные о задачах
 * 
 * @returns {Object} - Объект с задачами
 */
function loadTasks() {
  const tasksPath = path.join(process.cwd(), 'tasks', 'tasks.json');
  if (!fs.existsSync(tasksPath)) {
    return { tasks: [] };
  }
  
  try {
    const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    return tasksData;
  } catch (error) {
    console.error('Ошибка при загрузке задач:', error);
    return { tasks: [] };
  }
}

/**
 * Загрузить контекстные данные для задачи
 * 
 * @param {number} taskId - ID задачи
 * @returns {Object|null} - Контекстные данные или null при ошибке
 */
function loadTaskContext(taskId) {
  const contextPath = path.join(process.cwd(), 'tasks', 'context', `task-${taskId}.json`);
  if (!fs.existsSync(contextPath)) {
    return null;
  }
  
  try {
    const contextData = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    return contextData;
  } catch (error) {
    console.error(`Ошибка при загрузке контекста задачи #${taskId}:`, error);
    return null;
  }
}

/**
 * Сохранить контекстные данные для задачи
 * 
 * @param {number} taskId - ID задачи
 * @param {Object} contextData - Контекстные данные
 * @returns {boolean} - Успешно ли сохранены данные
 */
function saveTaskContext(taskId, contextData) {
  try {
    const contextDir = path.join(process.cwd(), 'tasks', 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    
    const contextPath = path.join(contextDir, `task-${taskId}.json`);
    fs.writeFileSync(contextPath, JSON.stringify(contextData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Ошибка при сохранении контекста задачи #${taskId}:`, error);
    return false;
  }
}

/**
 * Проверить и обновить контекст для GitHub Copilot
 * 
 * @param {number} taskId - ID задачи
 * @returns {boolean} - Успешно ли обновлен контекст
 */
async function checkAndUpdateCopilotContext(taskId) {
  const tasksData = loadTasks();
  const task = tasksData.tasks.find(t => t.id === taskId);
  
  if (!task) {
    console.error(`Задача с ID ${taskId} не найдена`);
    return false;
  }
  
  // Загрузить контекст задачи
  const contextData = loadTaskContext(taskId);
  
  // Сохранить форматированный контекст для Copilot
  return await copilot.saveFormattedCopilotContext(task, contextData);
}

/**
 * Подготовить контекст для GitHub Copilot
 * 
 * @param {number} taskId - ID задачи (опционально)
 * @returns {string|null} - Форматированный контекст для Copilot или null при ошибке
 */
async function prepareCopilotContext(taskId) {
  // Если taskId не указан, используем активную задачу
  if (!taskId) {
    const currentContext = await contextTracker.getCurrentContext();
    if (currentContext && currentContext.activeTask) {
      taskId = currentContext.activeTask;
    } else {
      console.error('Нет активной задачи для создания контекста');
      return null;
    }
  }
  
  if (await checkAndUpdateCopilotContext(taskId)) {
    return await copilot.getSavedCopilotContext();
  }
  
  return null;
}

/**
 * Предложить задачу для выполнения и подготовить для нее контекст
 * 
 * @returns {Object|null} - Данные о предложенной задаче или null при ошибке
 */
async function suggestTaskAndPrepareContext() {
  const tasksData = loadTasks();
  if (!tasksData.tasks || tasksData.tasks.length === 0) {
    return null;
  }
  
  // Найти невыполненные задачи
  const pendingTasks = tasksData.tasks.filter(t => t.status !== 'done');
  if (pendingTasks.length === 0) {
    return {
      message: 'Все задачи выполнены! Можно создать новые задачи.',
      allTasksDone: true
    };
  }
  
  // Найти задачи с приоритетом
  let suggestedTask = pendingTasks.find(t => t.priority === 'high');
  
  // Если нет задач с высоким приоритетом, берем первую невыполненную
  if (!suggestedTask) {
    suggestedTask = pendingTasks[0];
  }
  
  // Подготовить контекст для предложенной задачи
  await checkAndUpdateCopilotContext(suggestedTask.id);
  
  return {
    message: `Предлагаю выполнить задачу #${suggestedTask.id}: ${suggestedTask.title}`,
    taskId: suggestedTask.id,
    task: suggestedTask
  };
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);
const command = args[0] || 'summary';
const taskId = args[1] ? parseInt(args[1]) : null;

// Вспомогательная функция для вывода справки
function showHelp() {
  console.log(chalk.bold('\n📋 Task Master: Управление контекстом проекта\n'));
  console.log('Использование: task-master context [команда] [параметры]\n');
  
  console.log('Доступные команды:');
  console.log(`  ${chalk.cyan('summary')}              - Показать краткую сводку о состоянии проекта (по умолчанию)`);
  console.log(`  ${chalk.cyan('history')} [taskId]     - Показать историю задачи или всех задач`);
  console.log(`  ${chalk.cyan('init')}                 - Инициализировать файл контекста`);
  console.log(`  ${chalk.cyan('update')} <taskId>      - Обновить контекст для задачи`);
  console.log(`  ${chalk.cyan('copilot')} [taskId]     - Подготовить контекст для GitHub Copilot`);
  console.log(`  ${chalk.cyan('check-context')} <taskId> - Проверить и обновить контекст для GitHub Copilot`);
  console.log(`  ${chalk.cyan('suggest')}              - Предложить выполнение задачи и подготовить контекст`);
  console.log(`  ${chalk.cyan('help')}                 - Показать эту справку\n`);
  
  console.log('Примеры:');
  console.log('  task-master context                   - Показать общую сводку');
  console.log('  task-master context history 3         - Показать историю задачи #3');
  console.log('  task-master context update 2 "Описание выполненной работы"  - Обновить контекст задачи #2');
  console.log('  task-master context copilot 2         - Подготовить контекст задачи #2 для GitHub Copilot');
  console.log('  task-master context suggest           - Предложить выполнение задачи\n');
}

/**
 * Функция для обновления контекста задачи
 * 
 * @param {number} taskId - ID задачи
 * @param {string} summary - Описание выполненной работы
 */
function updateTaskContext(taskId, summary) {
  if (!summary) {
    console.log(chalk.yellow('⚠ Необходимо указать описание выполненной работы'));
    return;
  }
  
  // Получаем задачу и её текущий статус
  const tasks = contextTracker.loadTasks();
  if (!tasks) return;
  
  const task = tasks.tasks.find(t => t.id === taskId);
  if (!task) {
    console.log(chalk.red(`✗ Задача с ID ${taskId} не найдена`));
    return;
  }
  
  // Если задача не в процессе, меняем её статус
  let status = task.status;
  if (status !== 'in-progress') {
    status = 'in-progress';
    console.log(chalk.blue(`ℹ Статус задачи #${taskId} изменен на "в процессе"`));
  }
  
  // Обновляем статус и добавляем запись в историю
  if (contextTracker.updateTaskStatus(taskId, status, summary)) {
    console.log(chalk.green(`✓ Контекст задачи #${taskId} успешно обновлен`));
    console.log(chalk.dim(`Описание: ${summary}`));
  } else {
    console.log(chalk.red(`✗ Не удалось обновить контекст задачи #${taskId}`));
  }
}

/**
 * Функция для завершения задачи и обновления контекста
 * 
 * @param {number} taskId - ID задачи
 * @param {string} summary - Описание выполненной работы
 */
function completeTask(taskId, summary) {
  if (!summary) {
    console.log(chalk.yellow('⚠ Необходимо указать описание выполненной работы'));
    return;
  }
  
  // Обновляем статус и добавляем запись в историю
  if (contextTracker.updateTaskStatus(taskId, 'done', summary)) {
    console.log(chalk.green(`✓ Задача #${taskId} отмечена как выполненная`));
    console.log(chalk.dim(`Описание: ${summary}`));
  } else {
    console.log(chalk.red(`✗ Не удалось отметить задачу #${taskId} как выполненную`));
  }
}

// Основная логика скрипта
try {
  switch (command) {
    case 'summary':
      // Показать общую сводку о состоянии проекта
      console.log(chalk.bold('\n📊 Сводка о состоянии проекта\n'));
      console.log(contextTracker.getProjectSummary());
      break;
      
    case 'history':
      // Показать историю задачи или всех задач
      if (taskId) {
        console.log(chalk.bold(`\n📜 История выполнения задачи #${taskId}\n`));
        console.log(contextTracker.getFormattedTaskHistory(taskId));
      } else {
        console.log(chalk.bold('\n📜 Полная история выполнения задач\n'));
        console.log(contextTracker.getFormattedFullHistory());
      }
      break;
      
    case 'init':
      // Инициализировать файл контекста
      contextTracker.initContext();
      console.log(chalk.green('✓ Файл контекста успешно инициализирован'));
      break;
      
    case 'update':
      // Обновить контекст для задачи
      if (!taskId) {
        console.log(chalk.red('✗ Необходимо указать ID задачи'));
        showHelp();
      } else {
        const summary = args.slice(2).join(' ');
        updateTaskContext(taskId, summary);
      }
      break;
      
    case 'complete':
      // Завершить задачу и обновить контекст
      if (!taskId) {
        console.log(chalk.red('✗ Необходимо указать ID задачи'));
        showHelp();
      } else {
        const summary = args.slice(2).join(' ');
        completeTask(taskId, summary);
      }
      break;
      
    case 'copilot':
      // Подготовить контекст для GitHub Copilot
      prepareCopilotContext(taskId);
      break;
      
    case 'check-context':
      // Проверить и при необходимости обновить контекст для GitHub Copilot
      if (!taskId) {
        console.log(chalk.red('✗ Необходимо указать ID задачи'));
        showHelp();
      } else {
        checkAndUpdateCopilotContext(taskId);
      }
      break;
      
    case 'suggest':
      // Предложить выполнение задачи и подготовить контекст для GitHub Copilot
      suggestTaskAndPrepareContext();
      break;
      
    case 'help':
    default:
      showHelp();
      break;
  }
} catch (error) {
  console.error(chalk.red(`✗ Ошибка: ${error.message}`));
}

// Экспорт функций для использования в других модулях
module.exports = {
  loadTasks,
  loadTaskContext,
  saveTaskContext,
  checkAndUpdateCopilotContext,
  prepareCopilotContext,
  suggestTaskAndPrepareContext,
  updateTaskContext,
  completeTask
};
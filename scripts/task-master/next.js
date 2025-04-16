#!/usr/bin/env node

/**
 * Скрипт для перехода к следующей задаче и обновления 
 * контекста для GitHub Copilot
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

/**
 * Получить следующую задачу на основе приоритета
 * @returns {object|null} - Объект задачи или null
 */
function getNextTask() {
  const tasksData = loadTasks();
  
  // Сортируем задачи по приоритету (high, medium, low)
  const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
  
  // Фильтруем задачи, которые еще не выполнены (статус pending)
  const pendingTasks = tasksData.tasks.filter(task => task.status === 'pending');
  
  // Сортируем по приоритету
  pendingTasks.sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  // Возвращаем первую задачу или null, если нет задач
  return pendingTasks.length > 0 ? pendingTasks[0] : null;
}

/**
 * Получить текущую задачу в процессе выполнения
 * @returns {object|null} - Объект задачи или null
 */
function getCurrentTask() {
  const tasksData = loadTasks();
  
  // Находим задачу со статусом in-progress
  const activeTasks = tasksData.tasks.filter(task => task.status === 'in-progress');
  
  // Если есть активная задача, возвращаем первую найденную
  return activeTasks.length > 0 ? activeTasks[0] : null;
}

/**
 * Начать выполнение следующей задачи
 * @param {boolean} auto - Автоматически определить следующую задачу
 * @param {string} targetTaskId - ID задачи, которую нужно начать (если auto=false)
 * @returns {object} - Результат операции
 */
function startNextTask(auto = true, targetTaskId = null) {
  const tasksData = loadTasks();
  
  let task = null;
  
  if (auto) {
    // Получаем следующую задачу по приоритету
    task = getNextTask();
  } else if (targetTaskId) {
    // Находим задачу по ID
    const taskId = parseInt(targetTaskId);
    task = tasksData.tasks.find(t => t.id === taskId && t.status === 'pending');
  }
  
  if (!task) {
    return {
      success: false,
      message: auto 
        ? 'Нет задач в статусе pending. Все задачи выполнены или находятся в процессе.' 
        : `Задача с ID ${targetTaskId} не найдена или не находится в статусе pending.`
    };
  }
  
  // Проверяем, есть ли задача в процессе выполнения
  const currentTask = getCurrentTask();
  
  if (currentTask) {
    return {
      success: false,
      message: `Уже есть задача в процессе выполнения: #${currentTask.id} "${currentTask.title}". Завершите её перед началом новой задачи.`,
      currentTask
    };
  }
  
  // Обновляем статус задачи на "в процессе"
  task.status = 'in-progress';
  task.updated_at = new Date().toISOString();
  
  // Находим индекс задачи в массиве
  const taskIndex = tasksData.tasks.findIndex(t => t.id === task.id);
  
  if (taskIndex !== -1) {
    tasksData.tasks[taskIndex] = task;
    
    // Сохраняем изменения
    if (saveTasks(tasksData)) {
      // Обновляем контекст задачи
      contextTracker.updateTaskStatus(
        task.id, 
        'in-progress', 
        `Начато выполнение задачи "${task.title}"`
      );
      
      // Подготавливаем контекст для GitHub Copilot
      const copilotContext = contextTracker.prepareTaskContextForCopilot(task.id);
      
      return {
        success: true,
        message: `✓ Задача #${task.id} "${task.title}" отмечена как "в процессе"`,
        task,
        copilotContext
      };
    } else {
      return {
        success: false,
        message: 'Не удалось сохранить изменения'
      };
    }
  } else {
    return {
      success: false,
      message: `Задача с ID ${task.id} не найдена в списке задач`
    };
  }
}

/**
 * Показать информацию о следующей задаче
 * @returns {object} - Информация о следующей задаче или null
 */
function showNextTaskInfo() {
  const nextTask = getNextTask();
  
  if (!nextTask) {
    console.log(chalk.yellow('Нет задач в статусе pending. Все задачи выполнены или находятся в процессе.'));
    return null;
  }
  
  console.log(chalk.cyan('🚀 Следующая задача:'));
  console.log(chalk.cyan(`#${nextTask.id}: ${nextTask.title}`));
  console.log(chalk.cyan(`Приоритет: ${nextTask.priority}`));
  
  if (nextTask.description) {
    console.log(chalk.cyan(`Описание: ${nextTask.description}`));
  }
  
  if (nextTask.subtasks && nextTask.subtasks.length > 0) {
    console.log(chalk.cyan('\nПодзадачи:'));
    nextTask.subtasks.forEach(subtask => {
      const statusEmoji = subtask.status === 'done' ? '✓' : '○';
      console.log(chalk.cyan(`${statusEmoji} ${subtask.id} ${subtask.title}`));
    });
  }
  
  // Подготовка контекста для GitHub Copilot
  const copilotContext = contextTracker.prepareTaskContextForCopilot(nextTask.id);
  console.log(chalk.green('\n💡 Контекст для GitHub Copilot готов. Чтобы начать выполнение, используйте:'));
  console.log(chalk.blue(`task-master next:start`));
  
  return {
    task: nextTask,
    copilotContext
  };
}

/**
 * Проверить текущий прогресс по задачам
 */
function checkTaskProgress() {
  const tasksData = loadTasks();
  
  const totalTasks = tasksData.tasks.length;
  const doneTasks = tasksData.tasks.filter(task => task.status === 'done').length;
  const inProgressTasks = tasksData.tasks.filter(task => task.status === 'in-progress').length;
  const pendingTasks = tasksData.tasks.filter(task => task.status === 'pending').length;
  
  const progressPercentage = (doneTasks / totalTasks) * 100;
  
  console.log(chalk.cyan('📊 Прогресс выполнения задач:'));
  console.log(chalk.cyan(`Всего задач: ${totalTasks}`));
  console.log(chalk.green(`✓ Выполнено: ${doneTasks} (${progressPercentage.toFixed(1)}%)`));
  console.log(chalk.yellow(`🔄 В процессе: ${inProgressTasks}`));
  console.log(chalk.blue(`⏳ Ожидают: ${pendingTasks}`));
  
  // Если есть задача в процессе выполнения, показываем её
  const currentTask = getCurrentTask();
  
  if (currentTask) {
    console.log(chalk.yellow('\n🔄 Текущая задача в процессе выполнения:'));
    console.log(chalk.yellow(`#${currentTask.id}: ${currentTask.title}`));
    
    if (currentTask.subtasks && currentTask.subtasks.length > 0) {
      const doneSubtasks = currentTask.subtasks.filter(st => st.status === 'done').length;
      const subtaskProgress = (doneSubtasks / currentTask.subtasks.length) * 100;
      
      console.log(chalk.yellow(`Прогресс подзадач: ${doneSubtasks}/${currentTask.subtasks.length} (${subtaskProgress.toFixed(1)}%)`));
    }
    
    // Подготовка контекста для GitHub Copilot для текущей задачи
    contextTracker.prepareTaskContextForCopilot(currentTask.id);
  }
  
  return {
    totalTasks,
    doneTasks,
    inProgressTasks,
    pendingTasks,
    progressPercentage,
    currentTask
  };
}

// Если скрипт запущен из командной строки
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || '';
  
  if (command === 'start') {
    // Начинаем выполнение следующей задачи
    const taskId = args[1];
    const auto = !taskId;
    
    const result = startNextTask(auto, taskId);
    
    if (result.success) {
      console.log(chalk.green(result.message));
      
      // Если у задачи есть подзадачи, показываем их
      if (result.task.subtasks && result.task.subtasks.length > 0) {
        console.log(chalk.cyan('\nПодзадачи:'));
        result.task.subtasks.forEach(subtask => {
          const statusEmoji = subtask.status === 'done' ? '✓' : '○';
          console.log(chalk.cyan(`${statusEmoji} ${subtask.id} ${subtask.title}`));
        });
      }
      
      console.log(chalk.green('\n💡 Контекст задачи автоматически обновлен для GitHub Copilot'));
      console.log(chalk.cyan('Теперь можете попросить Copilot помочь с выполнением этой задачи.'));
    } else {
      console.log(chalk.red(result.message));
      
      // Если есть текущая задача, предлагаем её завершить
      if (result.currentTask) {
        console.log(chalk.yellow('\nЧтобы завершить текущую задачу, используйте:'));
        console.log(chalk.blue(`task-master complete ${result.currentTask.id}`));
      }
    }
  } else if (command === 'progress') {
    // Показываем прогресс по задачам
    checkTaskProgress();
  } else {
    // По умолчанию показываем информацию о следующей задаче
    showNextTaskInfo();
  }
}

// Экспорт функций для использования в других модулях
module.exports = {
  getNextTask,
  getCurrentTask,
  startNextTask,
  checkTaskProgress,
  showNextTaskInfo
};
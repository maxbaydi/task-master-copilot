#!/usr/bin/env node

/**
 * Скрипт для отметки задач как выполненных и автоматического 
 * обновления контекста для GitHub Copilot
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
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
 * Отметка задачи или подзадачи как выполненной с обновлением контекста
 * @param {string} taskId - ID задачи или подзадачи
 * @param {string} summary - Описание результата выполнения
 * @returns {object} - Результат выполнения и информация для перехода к следующей задаче
 */
function completeTaskWithContextUpdate(taskId, summary) {
  const tasksData = loadTasks();
  let success = false;
  let message = '';
  let isMainTask = !taskId.includes('.');
  let mainTaskId = isMainTask ? parseInt(taskId) : parseInt(taskId.split('.')[0]);
  
  // Проверяем, является ли ID подзадачей
  if (!isMainTask) {
    const [parentId, subtaskId] = taskId.split('.');
    const parentIdNum = parseInt(parentId);
    
    // Находим родительскую задачу
    const parentTask = tasksData.tasks.find(task => task.id === parentIdNum);
    
    if (!parentTask) {
      return {
        success: false,
        message: `✗ Задача с ID ${parentIdNum} не найдена`,
        nextTask: null
      };
    }
    
    // Находим подзадачу
    const subtask = parentTask.subtasks.find(st => st.id === taskId);
    
    if (!subtask) {
      return {
        success: false,
        message: `✗ Подзадача с ID ${taskId} не найдена`,
        nextTask: null
      };
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
    success = saveTasks(tasksData);
    
    if (success) {
      // Добавляем запись в историю выполнения и контекст
      const autoSummary = summary || `Выполнена подзадача ${taskId} "${subtask.title}"`;
      contextTracker.addHistoryEntry(parentIdNum, 'update', autoSummary);

      if (allSubtasksDone) {
        // Обновляем статус задачи в контексте
        contextTracker.updateTaskStatus(parentIdNum, 'done', `Выполнены все подзадачи (${parentTask.subtasks.length})`);
      }
      
      message = `✓ Подзадача #${taskId} отмечена как выполненная`;
      if (allSubtasksDone) {
        message += `\n✓ Все подзадачи выполнены, задача #${parentIdNum} отмечена как выполненная`;
      }
    } else {
      message = '✗ Не удалось сохранить изменения';
    }
  } else {
    // Отмечаем задачу как выполненную
    const taskIdNum = parseInt(taskId);
    const task = tasksData.tasks.find(t => t.id === taskIdNum);
    
    if (!task) {
      return {
        success: false,
        message: `✗ Задача с ID ${taskIdNum} не найдена`,
        nextTask: null
      };
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
    success = saveTasks(tasksData);
    
    if (success) {
      // Обновляем контекст задачи
      const autoSummary = summary || `Выполнена задача "${task.title}"${task.subtasks.length > 0 ? ` и все её подзадачи (${task.subtasks.length})` : ''}`;
      contextTracker.updateTaskStatus(taskIdNum, 'done', autoSummary);

      message = `✓ Задача #${taskIdNum} "${task.title}" отмечена как выполненная`;
    } else {
      message = '✗ Не удалось сохранить изменения';
    }
  }
  
  let contextUpdateResult = null;
  let nextTask = null;
  
  if (success) {
    // Обновляем контекст и получаем информацию о следующей задаче
    contextUpdateResult = contextTracker.updateContextAfterTaskCompletion(
      mainTaskId, 
      summary || `Задача ${taskId} завершена успешно`
    );
    
    nextTask = contextUpdateResult.nextTask;
  }
  
  return {
    success,
    message,
    nextTask,
    copilotContext: contextUpdateResult ? contextUpdateResult.copilotContext : null
  };
}

/**
 * Интерактивный режим выполнения задачи
 * @param {string} taskId - ID задачи
 */
async function completeTaskInteractive(taskId) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log(chalk.blue('Введите краткое описание результата выполнения задачи:'));
  
  rl.question('> ', (summary) => {
    // Отмечаем задачу как выполненную с указанным описанием
    const result = completeTaskWithContextUpdate(taskId, summary);
    
    console.log(chalk.green(result.message));
    
    // Если успешно выполнена и есть следующая задача
    if (result.success && result.nextTask) {
      console.log('');
      console.log(chalk.cyan('🚀 Следующая задача:'));
      console.log(chalk.cyan(`#${result.nextTask.id}: ${result.nextTask.title}`));
      console.log(chalk.cyan(`Приоритет: ${result.nextTask.priority}`));
      if (result.nextTask.description) {
        console.log(chalk.cyan(`Описание: ${result.nextTask.description}`));
      }
      
      console.log('');
      console.log(chalk.yellow('📝 Хотите начать выполнение следующей задачи? (y/n)'));
      
      rl.question('> ', (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'да') {
          // Обновляем статус следующей задачи на "в процессе"
          result.nextTask.status = 'in-progress';
          result.nextTask.updated_at = new Date().toISOString();
          
          const tasksData = loadTasks();
          const nextTaskIndex = tasksData.tasks.findIndex(t => t.id === result.nextTask.id);
          
          if (nextTaskIndex !== -1) {
            tasksData.tasks[nextTaskIndex] = result.nextTask;
            saveTasks(tasksData);
          }
          
          // Обновляем контекст следующей задачи
          contextTracker.updateTaskStatus(
            result.nextTask.id, 
            'in-progress', 
            `Начато выполнение задачи "${result.nextTask.title}"`
          );
          
          console.log(chalk.green(`✓ Задача #${result.nextTask.id} отмечена как "в процессе"`));
          console.log(chalk.green('💡 Контекст обновлен для GitHub Copilot'));
        } else {
          console.log(chalk.yellow('Начало следующей задачи отменено.'));
        }
        
        rl.close();
      });
    } else {
      rl.close();
    }
  });
}

/**
 * Показать информацию о следующей задаче
 */
function showNextTask() {
  const nextTask = contextTracker.getNextTask();
  
  if (!nextTask) {
    console.log(chalk.yellow('Нет задач в статусе pending. Все задачи выполнены или находятся в процессе.'));
    return;
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
  console.log(chalk.blue(`task-master complete:start ${nextTask.id}`));
}

/**
 * Начать выполнение задачи (отметить как "в процессе" и обновить контекст)
 * @param {string} taskId - ID задачи
 */
function startTaskExecution(taskId) {
  const tasksData = loadTasks();
  const task = taskId ? tasksData.tasks.find(t => t.id === parseInt(taskId)) : contextTracker.getNextTask();
  
  if (!task) {
    console.log(chalk.red(`✗ Задача${taskId ? ` с ID ${taskId}` : ''} не найдена`));
    return;
  }
  
  // Обновляем статус задачи на "в процессе"
  task.status = 'in-progress';
  task.updated_at = new Date().toISOString();
  
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
      
      console.log(chalk.green(`✓ Задача #${task.id} "${task.title}" отмечена как "в процессе"`));
      console.log(chalk.green('💡 Контекст задачи обновлен для GitHub Copilot'));
      
      // Выводим информацию о подзадачах, если они есть
      if (task.subtasks && task.subtasks.length > 0) {
        console.log(chalk.cyan('\nПодзадачи:'));
        task.subtasks.forEach(subtask => {
          const statusEmoji = subtask.status === 'done' ? '✓' : '○';
          console.log(chalk.cyan(`${statusEmoji} ${subtask.id} ${subtask.title}`));
        });
      }
    } else {
      console.log(chalk.red('✗ Не удалось сохранить изменения'));
    }
  } else {
    console.log(chalk.red(`✗ Задача с ID ${task.id} не найдена в списке задач`));
  }
}

// Если скрипт запущен из командной строки
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || '';
  
  if (command === 'next') {
    // Показываем информацию о следующей задаче
    showNextTask();
  } else if (command === 'start') {
    // Начинаем выполнение задачи
    const taskId = args[1];
    startTaskExecution(taskId);
  } else {
    // Получаем ID задачи
    const taskId = args[0];
    
    if (!taskId) {
      console.log(chalk.yellow('Не указан ID задачи. Пример использования:'));
      console.log(chalk.blue('npm run task-master:complete 1'));
      console.log(chalk.blue('npm run task-master:complete 1.2'));
      console.log(chalk.blue('\nИли для интерактивного режима:'));
      console.log(chalk.blue('npm run task-master:complete:interactive 1'));
      process.exit(1);
    }
    
    // Проверяем, запущен ли скрипт в интерактивном режиме
    const isInteractive = process.env.TASK_MASTER_INTERACTIVE === 'true' || args[1] === '--interactive' || args[1] === '-i';
    
    if (isInteractive) {
      // Запускаем интерактивный режим
      completeTaskInteractive(taskId);
    } else {
      // Выполняем задачу без интерактивного режима
      const result = completeTaskWithContextUpdate(taskId);
      console.log(chalk.green(result.message));
      
      // Если есть следующая задача, предлагаем её
      if (result.success && result.nextTask) {
        console.log('');
        console.log(chalk.cyan('🚀 Следующая задача:'));
        console.log(chalk.cyan(`#${result.nextTask.id}: ${result.nextTask.title}`));
        console.log(chalk.cyan(`Приоритет: ${result.nextTask.priority}`));
        
        console.log(chalk.green('\n💡 Контекст для GitHub Copilot готов. Чтобы начать выполнение, используйте:'));
        console.log(chalk.blue(`task-master complete:start ${result.nextTask.id}`));
      }
    }
  }
}

// Экспорт функций для использования в других модулях
module.exports = {
  completeTaskWithContextUpdate,
  startTaskExecution,
  showNextTask
};
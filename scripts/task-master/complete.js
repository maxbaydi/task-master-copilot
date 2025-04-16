#!/usr/bin/env node

/**
 * Скрипт для отметки задачи как выполненной
 * Позволяет отмечать задачи и подзадачи как выполненные
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Путь к файлу задач
const tasksFile = path.join(process.cwd(), 'tasks', 'tasks.json');

// Функция загрузки задач из файла
function loadTasks() {
  if (!fs.existsSync(tasksFile)) {
    console.log(chalk.red('✗ Файл tasks.json не найден. Запустите npm run task-master:init'));
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

// Функция для отметки задачи как выполненной
function completeTask() {
  const args = process.argv.slice(2);
  const taskId = args[0];
  
  if (!taskId) {
    console.log(chalk.red('✗ Не указан ID задачи или подзадачи'));
    console.log(chalk.blue('Использование: npm run task-master:complete <id>'));
    console.log(chalk.blue('Пример: npm run task-master:complete 1     - отметить задачу #1 как выполненную'));
    console.log(chalk.blue('Пример: npm run task-master:complete 1.2   - отметить подзадачу #1.2 как выполненную'));
    process.exit(1);
  }
  
  const tasksData = loadTasks();
  
  // Проверяем, является ли ID подзадачей
  if (taskId.includes('.')) {
    const [parentId, subtaskId] = taskId.split('.');
    const parentIdNum = parseInt(parentId);
    
    // Находим родительскую задачу
    const parentTask = tasksData.tasks.find(task => task.id === parentIdNum);
    
    if (!parentTask) {
      console.log(chalk.red(`✗ Задача с ID ${parentIdNum} не найдена`));
      process.exit(1);
    }
    
    // Находим подзадачу
    const subtask = parentTask.subtasks.find(st => st.id === taskId);
    
    if (!subtask) {
      console.log(chalk.red(`✗ Подзадача с ID ${taskId} не найдена`));
      process.exit(1);
    }
    
    // Отмечаем подзадачу как выполненную
    subtask.status = 'done';
    
    // Проверяем, все ли подзадачи выполнены
    const allSubtasksDone = parentTask.subtasks.every(st => st.status === 'done');
    
    // Если все подзадачи выполнены, отмечаем родительскую задачу как выполненную
    if (allSubtasksDone) {
      parentTask.status = 'done';
      console.log(chalk.green(`✓ Все подзадачи выполнены, задача #${parentIdNum} отмечена как выполненная`));
    }
    
    // Обновляем дату изменения
    parentTask.updated_at = new Date().toISOString();
    
    // Сохраняем изменения
    if (saveTasks(tasksData)) {
      console.log(chalk.green(`✓ Подзадача #${taskId} отмечена как выполненная`));
    }
  } else {
    // Отмечаем задачу как выполненную
    const taskIdNum = parseInt(taskId);
    const task = tasksData.tasks.find(t => t.id === taskIdNum);
    
    if (!task) {
      console.log(chalk.red(`✗ Задача с ID ${taskIdNum} не найдена`));
      process.exit(1);
    }
    
    // Отмечаем задачу и все подзадачи как выполненные
    task.status = 'done';
    task.updated_at = new Date().toISOString();
    
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(st => {
        st.status = 'done';
      });
      console.log(chalk.blue(`ℹ Все подзадачи также отмечены как выполненные`));
    }
    
    // Сохраняем изменения
    if (saveTasks(tasksData)) {
      console.log(chalk.green(`✓ Задача #${taskIdNum} "${task.title}" отмечена как выполненная`));
    }
  }
}

// Запуск
completeTask();
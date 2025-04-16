#!/usr/bin/env node

/**
 * Скрипт для получения следующей задачи
 * Выводит следующую задачу со статусом pending с наивысшим приоритетом
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
  } catch (error) {
    console.log(chalk.red(`✗ Ошибка при сохранении файла: ${error.message}`));
    process.exit(1);
  }
}

// Функция для получения следующей задачи
function getNextTask() {
  const tasksData = loadTasks();
  
  if (!tasksData.tasks || tasksData.tasks.length === 0) {
    console.log(chalk.yellow('Задачи не найдены. Добавьте задачи с помощью npm run task-master:generate'));
    return;
  }
  
  // Получить следующую задачу в статусе pending с наивысшим приоритетом
  const pendingTasks = tasksData.tasks.filter(task => task.status === 'pending');
  
  if (pendingTasks.length === 0) {
    console.log(chalk.yellow('Нет задач в статусе pending. Все задачи выполнены или находятся в процессе.'));
    return;
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
  
  // Вывод задачи
  console.log(chalk.bold(`\n🚀 Следующая задача:\n`));
  console.log(chalk.blue(`[${nextTask.id}] ${nextTask.title}`));
  console.log(chalk.dim(`Приоритет: ${nextTask.priority}`));
  console.log(`\n${nextTask.description}\n`);
  
  // Вывод подзадач
  if (nextTask.subtasks && nextTask.subtasks.length > 0) {
    console.log(chalk.bold('Подзадачи:'));
    nextTask.subtasks.forEach(subtask => {
      const statusEmoji = subtask.status === 'done' ? chalk.green('✓') : chalk.gray('○');
      console.log(`${statusEmoji} ${subtask.id} ${subtask.title}`);
    });
  }
  
  console.log(chalk.green('\n✓ Задача отмечена как "в процессе"\n'));
  console.log(chalk.dim('Используйте npm run task-master:complete <id> для отметки о выполнении задачи'));
}

// Запуск
getNextTask();
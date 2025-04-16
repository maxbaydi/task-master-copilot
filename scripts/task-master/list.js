#!/usr/bin/env node

/**
 * Скрипт для отображения списка задач
 * Выводит все задачи из файла tasks.json
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Определяем пути в зависимости от режима (локальный или глобальный)
const isGlobalMode = process.env.TASK_MASTER_MODE === 'global';
const tasksDir = process.env.TASK_MASTER_DIR || path.join(process.cwd(), 'tasks');
const tasksFile = process.env.TASK_MASTER_FILE || path.join(tasksDir, 'tasks.json');

// Функция загрузки задач из файла
function loadTasks() {
  if (!fs.existsSync(tasksFile)) {
    const initCommand = isGlobalMode ? 'task-master init' : 'npm run task-master:init';
    console.log(chalk.red(`✗ Файл tasks.json не найден. Запустите ${initCommand}`));
    console.log(chalk.blue(`Текущий режим: ${isGlobalMode ? 'глобальный' : 'локальный'}`));
    console.log(chalk.blue(`Путь к файлу: ${tasksFile}`));
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

// Функция отображения статуса задачи
function getStatusEmoji(status) {
  switch (status) {
    case 'done':
      return chalk.green('✓');
    case 'in-progress':
      return chalk.blue('⚙');
    case 'deferred':
      return chalk.yellow('⏸');
    case 'pending':
    default:
      return chalk.gray('○');
  }
}

// Функция для вывода списка задач
function listTasks() {
  const tasksData = loadTasks();
  
  console.log(chalk.bold(`\n📋 Задачи проекта: ${chalk.blue(tasksData.project)} (v${tasksData.version})\n`));
  
  if (!tasksData.tasks || tasksData.tasks.length === 0) {
    const generateCommand = isGlobalMode ? 'task-master generate' : 'npm run task-master:generate';
    console.log(chalk.yellow(`Задачи не найдены. Добавьте задачи с помощью ${generateCommand}`));
    return;
  }
  
  // Группировка задач по статусу
  const pending = tasksData.tasks.filter(task => task.status === 'pending');
  const inProgress = tasksData.tasks.filter(task => task.status === 'in-progress');
  const done = tasksData.tasks.filter(task => task.status === 'done');
  const deferred = tasksData.tasks.filter(task => task.status === 'deferred');
  
  // Функция для вывода задачи
  const printTask = (task) => {
    // Emoji для приоритета
    let priorityEmoji = '';
    switch(task.priority) {
      case 1: priorityEmoji = '🔴'; break; // Высокий
      case 2: priorityEmoji = '🟡'; break; // Средний
      case 3: priorityEmoji = '🟢'; break; // Низкий
      default: priorityEmoji = '⚪'; break;
    }
    
    console.log(`${getStatusEmoji(task.status)} [${task.id}] ${task.title} ${priorityEmoji} ${chalk.dim(`(приоритет: ${task.priority})`)}`);
    
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(subtask => {
        console.log(`  ${getStatusEmoji(subtask.status)} ${subtask.id} ${subtask.title}`);
      });
    }
  };
  
  // Вывод задач по группам
  if (inProgress.length > 0) {
    console.log(chalk.blue('\n⚙ В ПРОЦЕССЕ:'));
    inProgress.forEach(printTask);
  }
  
  if (pending.length > 0) {
    console.log(chalk.gray('\n○ ОЖИДАЮТ:'));
    pending.forEach(printTask);
  }
  
  if (done.length > 0) {
    console.log(chalk.green('\n✓ ВЫПОЛНЕНЫ:'));
    done.forEach(printTask);
  }
  
  if (deferred.length > 0) {
    console.log(chalk.yellow('\n⏸ ОТЛОЖЕНЫ:'));
    deferred.forEach(printTask);
  }
  
  console.log('\n');
  
  // Показываем подсказку по командам
  const chatCommand = isGlobalMode ? 'task-master chat' : 'npm run task-master:chat';
  console.log(chalk.dim(`Для получения справки, выполните: ${chatCommand} "справка"`));
  console.log('\n');
}

// Запуск
listTasks();
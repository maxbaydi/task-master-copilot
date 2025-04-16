#!/usr/bin/env node

/**
 * Глобальная точка входа для Task Master
 * Позволяет использовать Task Master из любой директории
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Определяем пути
const homeDir = os.homedir();
const globalTasksDir = path.join(homeDir, '.task-master');
const globalTasksFile = path.join(globalTasksDir, 'tasks.json');
const currentDir = process.cwd();
const localTasksDir = path.join(currentDir, 'tasks');
const localTasksFile = path.join(localTasksDir, 'tasks.json');

// Создаем глобальную директорию, если она не существует
if (!fs.existsSync(globalTasksDir)) {
  fs.mkdirSync(globalTasksDir, { recursive: true });
  console.log(chalk.green('✓ Создана глобальная директория для Task Master'));
}

// Функция для определения, используется ли локальный или глобальный режим
function determineMode() {
  // Проверяем наличие локального tasks.json
  const hasLocalTasks = fs.existsSync(localTasksFile);
  
  // Если есть локальный файл, используем его, иначе используем глобальный
  return {
    mode: hasLocalTasks ? 'local' : 'global',
    tasksFile: hasLocalTasks ? localTasksFile : globalTasksFile,
    tasksDir: hasLocalTasks ? localTasksDir : globalTasksDir
  };
}

// Функция для отображения справки
function showHelp() {
  console.log(chalk.bold('\n📋 Task Master - система управления задачами\n'));
  console.log('Использование: task-master [команда] [параметры]\n');
  console.log('Доступные команды:');
  console.log(`  ${chalk.cyan('init')}                  - Инициализация системы задач`);
  console.log(`  ${chalk.cyan('list')}                  - Показать список задач`);
  console.log(`  ${chalk.cyan('next')}                  - Получить следующую задачу`);
  console.log(`  ${chalk.cyan('generate')}              - Сгенерировать задачи из описания`);
  console.log(`  ${chalk.cyan('complete')} <id>         - Отметить задачу как выполненную`);
  console.log(`  ${chalk.cyan('chat')} "команда"        - Выполнить команду через интерфейс чата`);
  console.log(`  ${chalk.cyan('help')}                  - Показать эту справку\n`);
  
  console.log(chalk.bold('Команды чата:'));
  console.log(`  ${chalk.cyan('Создай задачу [название]')}               - Создать новую задачу`);
  console.log(`  ${chalk.cyan('Создай задачи [описание]')}               - Создать несколько задач`);
  console.log(`  ${chalk.cyan('Сгенерируй задачи из плана')}             - Создать задачи на основе плана`);
  console.log(`  ${chalk.cyan('Покажи задачи')}                         - Просмотр всех задач`);
  console.log(`  ${chalk.cyan('Отметь задачу X как выполненную')}        - Отметить задачу как выполненную`);
  console.log(`  ${chalk.cyan('Дай следующую задачу')}                   - Получить следующую задачу`);
  console.log(`  ${chalk.cyan('Справка')}                               - Подробная инструкция\n`);
  
  console.log(chalk.bold('Режим работы:'));
  const { mode } = determineMode();
  console.log(`  Текущий режим: ${mode === 'local' ? chalk.green('локальный') : chalk.blue('глобальный')}`);
  console.log(`  В локальном режиме задачи хранятся в текущем проекте.`);
  console.log(`  В глобальном режиме задачи хранятся в общей директории, доступной из любого проекта.\n`);
}

// Основная функция для запуска команд
function runCommand() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  // Определяем режим работы (локальный или глобальный)
  const { mode, tasksFile, tasksDir } = determineMode();
  
  // Получаем путь к директории скриптов
  const scriptDir = path.dirname(__filename);
  
  // Устанавливаем переменную окружения с путем к файлу задач
  process.env.TASK_MASTER_FILE = tasksFile;
  process.env.TASK_MASTER_DIR = tasksDir;
  process.env.TASK_MASTER_MODE = mode;
  
  // Маппинг команд на соответствующие скрипты
  const commandMap = {
    'init': path.join(scriptDir, 'init.js'),
    'list': path.join(scriptDir, 'list.js'),
    'next': path.join(scriptDir, 'next.js'),
    'generate': path.join(scriptDir, 'generate.js'),
    'complete': path.join(scriptDir, 'complete.js'),
    'chat': path.join(scriptDir, 'chat.js'),
    'help': null // Обрабатываем справку отдельно
  };
  
  // Если команда неизвестна, показываем справку
  if (!commandMap[command]) {
    if (command === 'help') {
      showHelp();
    } else {
      console.log(chalk.red(`Неизвестная команда: ${command}`));
      showHelp();
    }
    return;
  }
  
  try {
    // Выполняем скрипт для соответствующей команды
    const scriptPath = commandMap[command];
    const remainingArgs = args.slice(1);
    
    if (command === 'chat') {
      // Для команды chat, передаем все оставшиеся аргументы как единую строку
      const chatCommand = remainingArgs.join(' ');
      require(scriptPath);
      
      // Напрямую вызываем функцию processCommand из chat.js
      const { processCommand } = require(scriptPath);
      const result = processCommand(chatCommand);
      console.log(result);
    } else {
      // Для других команд, запускаем скрипт с оставшимися аргументами
      process.argv = [process.argv[0], scriptPath, ...remainingArgs];
      require(scriptPath);
    }
  } catch (error) {
    console.log(chalk.red(`Ошибка при выполнении команды: ${error.message}`));
  }
}

// Запускаем приложение
runCommand();
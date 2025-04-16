#!/usr/bin/env node

/**
 * Скрипт инициализации Task Master
 * Создает файл tasks.json, если он не существует
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Определяем пути в зависимости от режима (локальный или глобальный)
const isGlobalMode = process.env.TASK_MASTER_MODE === 'global';
const tasksDir = process.env.TASK_MASTER_DIR || path.join(process.cwd(), 'tasks');
const tasksFile = process.env.TASK_MASTER_FILE || path.join(tasksDir, 'tasks.json');

// Функция создания папки tasks, если она не существует
function createTasksDir() {
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
    console.log(chalk.green(`✓ Создана папка ${path.basename(tasksDir)}`));
  }
}

// Функция создания шаблона tasks.json
function createTasksFile() {
  if (!fs.existsSync(tasksFile)) {
    const template = {
      project: isGlobalMode ? 'Global Tasks' : path.basename(process.cwd()),
      version: '1.0.0',
      tasks: []
    };
    
    fs.writeFileSync(tasksFile, JSON.stringify(template, null, 2));
    console.log(chalk.green(`✓ Создан файл ${path.basename(tasksFile)}`));
  } else {
    console.log(chalk.yellow(`⚠ Файл ${path.basename(tasksFile)} уже существует`));
  }
}

// Основная функция
function init() {
  console.log(chalk.blue('Инициализация Task Master...'));
  
  createTasksDir();
  createTasksFile();
  
  console.log(chalk.green('\n✓ Task Master инициализирован успешно!'));
  console.log(chalk.blue(`\nРежим работы: ${isGlobalMode ? 'глобальный' : 'локальный'}`));
  console.log(chalk.blue(`Файл задач: ${tasksFile}`));
  
  if (isGlobalMode) {
    console.log(chalk.blue('\nДоступные команды:'));
    console.log('  task-master list - показать список задач');
    console.log('  task-master next - получить следующую задачу');
    console.log('  task-master generate - сгенерировать задачи из описания');
    console.log('  task-master chat "команда" - выполнить команду через интерфейс чата');
  } else {
    console.log(chalk.blue('\nДоступные команды:'));
    console.log('  npm run task-master:list - показать список задач');
    console.log('  npm run task-master:next - получить следующую задачу');
    console.log('  npm run task-master:generate - сгенерировать задачи из описания');
    console.log('  npm run task-master:chat "команда" - выполнить команду через интерфейс чата');
  }
  
  // Показываем новые возможности Task Master
  showNewFeatures();
}

// Функция для отображения информации о новых возможностях
function showNewFeatures() {
  console.log(chalk.yellow('\n🚀 НОВЫЕ ВОЗМОЖНОСТИ TASK MASTER:'));
  console.log(chalk.cyan('1. Пакетное создание задач:'));
  console.log('   Вы можете создавать несколько задач за один раз с помощью команды:');
  console.log('   "Создай задачи [описание]" или "Сгенерируй задачи [описание]"');
  console.log('   Разделяйте задачи символами "###"');
  
  console.log(chalk.cyan('\n2. Настройка приоритетов:'));
  console.log('   Указывайте приоритет для задач с помощью меток:');
  console.log('   [P:1] - высокий приоритет 🔴');
  console.log('   [P:2] - средний приоритет 🟡');
  console.log('   [P:3] - низкий приоритет 🟢');
  
  console.log(chalk.cyan('\n3. Автоматическое создание задач из плана:'));
  console.log('   Создавайте задачи на основе обсуждения проекта с помощью команды:');
  console.log('   "Создай список задач из плана" или "Сгенерируй задачи из нашего обсуждения"');
  
  console.log(chalk.cyan('\n4. Глобальный режим работы:'));
  console.log('   Task Master теперь может работать глобально, доступный из любой директории.');
  console.log('   При глобальной установке используйте команды вида:');
  console.log('   task-master [команда] [параметры]');
  console.log('\nВведите "task-master help" или "npm run task-master:chat "справка"" для получения полной документации.');
}

// Запуск инициализации
if (require.main === module) {
  init();
}

module.exports = { init };
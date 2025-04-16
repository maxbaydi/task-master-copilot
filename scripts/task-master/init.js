#!/usr/bin/env node

/**
 * Скрипт инициализации Task Master
 * Создает файл tasks.json, если он не существует
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Определяем глобальные пути
const homeDir = os.homedir();
const globalTasksDir = path.join(homeDir, '.task-master');

// Определяем локальные пути (всегда в текущей директории)
const currentDir = process.cwd();
const localTasksDir = path.join(currentDir, 'tasks');
const localTasksFile = path.join(localTasksDir, 'tasks.json');

// Получаем режим работы
const isGlobalCommand = process.env.TASK_MASTER_MODE === 'global';

// В любом случае, при выполнении init, мы создаем локальную структуру
console.log(chalk.blue(`Task Master инициализируется в директории: ${currentDir}`));

// Функция создания папки tasks, если она не существует
function createTasksDir() {
  if (!fs.existsSync(localTasksDir)) {
    fs.mkdirSync(localTasksDir, { recursive: true });
    console.log(chalk.green(`✓ Создана папка ${path.basename(localTasksDir)} в текущем проекте`));
  } else {
    console.log(chalk.yellow(`⚠ Папка ${path.basename(localTasksDir)} уже существует в текущем проекте`));
  }
}

// Функция создания шаблона tasks.json
function createTasksFile() {
  if (!fs.existsSync(localTasksFile)) {
    const template = {
      project: path.basename(currentDir),
      version: '1.0.0',
      tasks: []
    };
    
    fs.writeFileSync(localTasksFile, JSON.stringify(template, null, 2));
    console.log(chalk.green(`✓ Создан файл ${path.basename(localTasksFile)} в директории ${localTasksDir}`));
  } else {
    console.log(chalk.yellow(`⚠ Файл ${path.basename(localTasksFile)} уже существует в директории ${localTasksDir}`));
  }
}

// Функция создания файла COPILOT-INTEGRATION.md с инструкциями для Copilot
function createCopilotIntegrationFile() {
  const copilotFile = path.join(currentDir, 'COPILOT-INTEGRATION.md');
  if (!fs.existsSync(copilotFile)) {
    const content = `# Task Master: Интеграция с GitHub Copilot

Task Master предоставляет расширенные возможности для совместной работы с GitHub Copilot. Этот документ объясняет, как эффективно использовать Task Master в сочетании с Copilot для автоматизации процесса планирования и отслеживания задач.

## Основные сценарии использования

### 1. Автоматическое создание задач из обсуждения

GitHub Copilot может автоматически анализировать обсуждение проекта и создавать соответствующие задачи в Task Master. После обсуждения плана разработки, просто попросите Copilot создать список задач:

\`\`\`
Создай список задач из нашего обсуждения
\`\`\`

или

\`\`\`
Сгенерируй задачи из плана
\`\`\`

**Важно!** Для изменения статуса задач (например, отметки задачи как выполненной) всегда используйте соответствующий npm-скрипт:

\`\`\`
npm run task-master:complete <id>
\`\`\`

Где <id> — номер задачи (например, 1 или 1.2).

**Нельзя изменять файл tasks.json вручную!** Это может привести к ошибкам и рассинхронизации состояния задач.

Больше примеров и подробностей — в основном README или документации проекта.
`;
    fs.writeFileSync(copilotFile, content);
    console.log(chalk.green(`✓ Создан файл COPILOT-INTEGRATION.md с инструкциями для Copilot`));
  } else {
    console.log(chalk.yellow(`⚠ Файл COPILOT-INTEGRATION.md уже существует в корне проекта`));
  }
}

// Функция для создания глобальной директории
function setupGlobalDir() {
  if (!fs.existsSync(globalTasksDir)) {
    fs.mkdirSync(globalTasksDir, { recursive: true });
    console.log(chalk.green(`✓ Создана глобальная директория для Task Master: ${globalTasksDir}`));
  }
}

// Основная функция
function init() {
  console.log(chalk.blue('Инициализация Task Master...'));
  
  // Всегда создаем глобальную директорию для сервисных нужд
  setupGlobalDir();
  
  // Создаем структуру в текущем проекте
  createTasksDir();
  createTasksFile();
  createCopilotIntegrationFile();
  
  console.log(chalk.green('\n✓ Task Master инициализирован успешно в текущем проекте!'));
  
  // Информация о доступных командах зависит от того, глобально запущен или локально
  if (isGlobalCommand) {
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
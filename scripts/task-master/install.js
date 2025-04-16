#!/usr/bin/env node

/**
 * Скрипт для установки Task Master в любой проект
 * Создает необходимую структуру файлов и папок и добавляет скрипты в package.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Определяем пути
const currentDir = process.cwd();
const tasksDir = path.join(currentDir, 'tasks');
const scriptsDir = path.join(currentDir, 'scripts', 'task-master');
const homeDir = os.homedir();
const globalTasksDir = path.join(homeDir, '.task-master');

// Цвета для консоли (без зависимостей)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Функция для логирования с цветом
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

// Функция проверки наличия папки и создания, если ее нет
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`✓ Создана папка ${dir}`, colors.green);
    return true;
  }
  return false;
}

// Функция для копирования файла с заменой переменных
function copyFile(source, destination) {
  try {
    if (fs.existsSync(destination)) {
      log(`⚠ Файл ${destination} уже существует, пропускаем`, colors.yellow);
      return false;
    }
    
    let content = fs.readFileSync(source, 'utf8');
    
    // Замена путей в файле, если необходимо
    content = content.replace(/process\.cwd\(\)/g, 'process.cwd()');
    
    fs.writeFileSync(destination, content);
    log(`✓ Создан файл ${destination}`, colors.green);
    return true;
  } catch (error) {
    log(`✗ Ошибка при копировании файла ${source}: ${error.message}`, colors.red);
    return false;
  }
}

// Функция обновления package.json
function updatePackageJson() {
  const packageJsonPath = path.join(currentDir, 'package.json');
  
  try {
    // Проверяем существует ли package.json
    if (!fs.existsSync(packageJsonPath)) {
      log(`✗ Файл package.json не найден в текущей директории`, colors.red);
      const createPackageJson = `{
  "name": "project-with-task-master",
  "version": "1.0.0",
  "scripts": {
    "task-master:init": "node scripts/task-master/init.js",
    "task-master:list": "node scripts/task-master/list.js",
    "task-master:next": "node scripts/task-master/next.js",
    "task-master:generate": "node scripts/task-master/generate.js",
    "task-master:complete": "node scripts/task-master/complete.js",
    "task-master:chat": "node scripts/task-master/chat.js"
  },
  "dependencies": {
    "chalk": "^4.1.2"
  }
}`;
      fs.writeFileSync(packageJsonPath, createPackageJson);
      log(`✓ Создан файл package.json с необходимыми скриптами`, colors.green);
      return true;
    }
    
    // Читаем существующий package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Проверяем, есть ли уже скрипты task-master
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Добавляем скрипты task-master, если они отсутствуют
    const taskMasterScripts = {
      'task-master:init': 'node scripts/task-master/init.js',
      'task-master:list': 'node scripts/task-master/list.js',
      'task-master:next': 'node scripts/task-master/next.js',
      'task-master:generate': 'node scripts/task-master/generate.js',
      'task-master:complete': 'node scripts/task-master/complete.js',
      'task-master:chat': 'node scripts/task-master/chat.js'
    };
    
    let scriptsAdded = false;
    
    for (const [key, value] of Object.entries(taskMasterScripts)) {
      if (!packageJson.scripts[key]) {
        packageJson.scripts[key] = value;
        scriptsAdded = true;
      }
    }
    
    // Проверяем наличие зависимости chalk
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    let chalkAdded = false;
    if (!packageJson.dependencies.chalk) {
      packageJson.dependencies.chalk = "^4.1.2";
      chalkAdded = true;
    }
    
    // Сохраняем обновленный package.json
    if (scriptsAdded || chalkAdded) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      
      if (scriptsAdded) {
        log(`✓ Добавлены скрипты task-master в package.json`, colors.green);
      }
      
      if (chalkAdded) {
        log(`✓ Добавлена зависимость chalk в package.json`, colors.green);
      }
      
      return true;
    } else {
      log(`ℹ Скрипты task-master уже присутствуют в package.json`, colors.blue);
      return false;
    }
    
  } catch (error) {
    log(`✗ Ошибка при обновлении package.json: ${error.message}`, colors.red);
    return false;
  }
}

// Функция установки зависимостей
function installDependencies() {
  try {
    log(`ℹ Установка зависимостей...`, colors.blue);
    execSync('npm install chalk@4.1.2', { stdio: 'inherit' });
    log(`✓ Зависимости успешно установлены`, colors.green);
    return true;
  } catch (error) {
    log(`✗ Ошибка при установке зависимостей: ${error.message}`, colors.red);
    return false;
  }
}

// Функция для создания README-task-master.md
function createReadme() {
  const readmePath = path.join(currentDir, 'README-task-master.md');
  
  if (fs.existsSync(readmePath)) {
    log(`ℹ Файл README-task-master.md уже существует`, colors.blue);
    return false;
  }
  
  const readmeContent = `# Task Master

Task Master - это система управления задачами для разработки проекта, позволяющая организовать процесс без внешних API.

## Использование

### Локальная установка (в конкретном проекте)

В вашем проекте доступны следующие команды:

\`\`\`bash
# Инициализация системы задач (создает файл tasks.json)
npm run task-master:init

# Вывод списка всех задач
npm run task-master:list

# Получение следующей задачи для работы
npm run task-master:next

# Генерация задач из описания
npm run task-master:generate

# Отметка задачи как выполненной
npm run task-master:complete <id>

# Выполнение команд через интерфейс чата
npm run task-master:chat "команда"
\`\`\`

### Глобальная установка (доступ из любого проекта)

Для глобальной установки Task Master выполните:

\`\`\`bash
npm install -g task-master-ai
\`\`\`

После этого вы можете использовать следующие команды из любой директории:

\`\`\`bash
# Инициализация системы задач
task-master init

# Вывод списка всех задач
task-master list

# Получение следующей задачи для работы
task-master next

# Генерация задач из описания
task-master generate

# Отметка задачи как выполненной
task-master complete <id>

# Выполнение команд через интерфейс чата
task-master chat "команда"

# Получение справки
task-master help
\`\`\`

## Команды чата

Task Master поддерживает следующие команды через интерфейс чата:

1. **"Создай задачу [название]"** - создание новой задачи
2. **"Создай задачи [описание]"** - создание нескольких задач (разделяйте задачи с помощью ###)
3. **"Сгенерируй задачу [описание]"** - генерация задачи из подробного описания (поддерживает подзадачи)
4. **"Сгенерируй задачи из плана"** - автоматическое создание задач на основе обсуждения плана
5. **"Покажи список задач"** - просмотр всех задач
6. **"Отметь задачу X как выполненную"** - отметка задачи как выполненной
7. **"Дай следующую задачу"** - получение следующей задачи для работы
8. **"Справка"** - получение подробной документации

## Новые возможности

### Пакетное создание задач
Создавайте несколько задач за один раз с помощью команды "Создай задачи" или "Сгенерируй задачи", разделяя их символами "###".

### Настройка приоритетов
Указывайте приоритет для задач с помощью меток [P:1] (высокий), [P:2] (средний), [P:3] (низкий).

### Автоматическое создание задач из плана
Создавайте задачи на основе обсуждения проекта с помощью команды "Создай список задач из плана".

### Глобальный режим работы
Task Master теперь доступен из любой директории при глобальной установке.

## Структура задач

Задачи в файле tasks.json имеют следующую структуру:

\`\`\`json
{
  "id": 1,                                   // Уникальный идентификатор задачи
  "title": "Инициализация репозитория",      // Краткое описание задачи
  "description": "Создание новой структуры", // Подробное описание
  "status": "pending",                       // Статус (pending, in-progress, done, deferred)
  "priority": 1,                             // Приоритет (1-высший, 3-низший)
  "subtasks": [                              // Подзадачи
    {
      "id": "1.1",
      "title": "Создать структуру папок",
      "status": "pending"
    }
  ],
  "created_at": "2025-04-16T10:00:00.000Z", // Дата создания
  "updated_at": "2025-04-16T10:00:00.000Z"  // Дата обновления
}
\`\`\`

## Интеграция с GitHub Copilot

Task Master отлично работает в связке с GitHub Copilot. При обсуждении плана проекта с Copilot вы можете попросить его создать список задач командой:

\`\`\`
Создай список задач из нашего обсуждения
\`\`\`

После этого Copilot автоматически проанализирует контекст вашего обсуждения и создаст соответствующие задачи через Task Master.
`;
  
  fs.writeFileSync(readmePath, readmeContent);
  log(`✓ Создан файл README-task-master.md с инструкциями`, colors.green);
  return true;
}

// Функция для копирования скриптов из текущего проекта
function copyScriptsFromCurrentProject(sourceDir, targetDir) {
  try {
    // Получаем список файлов в исходной директории
    const files = fs.readdirSync(sourceDir);
    
    // Копируем каждый файл
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Проверяем, является ли это файлом или папкой
      const stats = fs.statSync(sourcePath);
      
      if (stats.isFile() && file.endsWith('.js')) {
        copyFile(sourcePath, targetPath);
      } else if (stats.isDirectory()) {
        ensureDir(targetPath);
        copyScriptsFromCurrentProject(sourcePath, targetPath);
      }
    }
    
    return true;
  } catch (error) {
    log(`✗ Ошибка при копировании скриптов: ${error.message}`, colors.red);
    return false;
  }
}

// Функция создания глобальной директории для задач
function setupGlobalTasksDir() {
  // Создаем глобальную директорию, если она не существует
  if (ensureDir(globalTasksDir)) {
    log(`✓ Создана глобальная директория для Task Master: ${globalTasksDir}`, colors.green);
    
    // Создаем template.json для глобальных задач
    const templatePath = path.join(globalTasksDir, 'template.json');
    if (!fs.existsSync(templatePath)) {
      const template = {
        project: 'Global Tasks',
        version: '1.0.0',
        tasks: []
      };
      
      fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
      log(`✓ Создан шаблон для глобальных задач`, colors.green);
    }
    
    return true;
  }
  return false;
}

// Функция для отображения новых возможностей Task Master
function showNewFeatures() {
  log(`\n${colors.bold}${colors.yellow}🚀 НОВЫЕ ВОЗМОЖНОСТИ TASK MASTER:${colors.reset}`, colors.yellow);

  log(`\n${colors.cyan}1. Пакетное создание задач:${colors.reset}`, colors.cyan);
  log(`   Вы можете создавать несколько задач за один раз с помощью команды:`);
  log(`   "Создай задачи [описание]" или "Сгенерируй задачи [описание]"`);
  log(`   Разделяйте задачи символами "###"`);
  
  log(`\n${colors.cyan}2. Настройка приоритетов:${colors.reset}`, colors.cyan);
  log(`   Указывайте приоритет для задач с помощью меток:`);
  log(`   [P:1] - высокий приоритет 🔴`);
  log(`   [P:2] - средний приоритет 🟡`);
  log(`   [P:3] - низкий приоритет 🟢`);
  
  log(`\n${colors.cyan}3. Автоматическое создание задач из плана:${colors.reset}`, colors.cyan);
  log(`   Создавайте задачи на основе обсуждения проекта с помощью команды:`);
  log(`   "Создай список задач из плана" или "Сгенерируй задачи из нашего обсуждения"`);
  
  log(`\n${colors.cyan}4. Глобальный режим работы:${colors.reset}`, colors.cyan);
  log(`   Task Master теперь может работать глобально, доступный из любой директории.`);
  log(`   При глобальной установке используйте команды вида:`);
  log(`   task-master [команда] [параметры]`);
  
  log(`\n${colors.cyan}5. Интеграция с GitHub Copilot:${colors.reset}`, colors.cyan);
  log(`   При обсуждении проекта с GitHub Copilot просто введите:`);
  log(`   "Создай список задач из нашего обсуждения"`);
  log(`   И Copilot автоматически создаст задачи на основе вашего плана.`);

  log(`\nПодробная документация доступна в файле README-task-master.md`, colors.blue);
}

// Основная функция установки
function install() {
  log(`${colors.bold}${colors.blue}Установка Task Master...${colors.reset}`, colors.blue);
  
  // Создаем необходимые директории
  ensureDir(tasksDir);
  ensureDir(scriptsDir);
  
  // Настраиваем глобальную директорию
  setupGlobalTasksDir();
  
  // Получаем путь к текущему скрипту
  const scriptPath = __filename;
  const scriptDir = path.dirname(scriptPath);
  
  // В текущем проекте скрипты task-master находятся в той же директории, где и install.js
  const sourceScriptsDir = scriptDir;
  const currentScriptsDir = path.join(currentDir, 'scripts', 'task-master');
  
  // Копируем скрипты только если это установка в новый проект (текущая директория отличается от директории скриптов)
  if (currentDir !== path.dirname(scriptDir) && fs.existsSync(sourceScriptsDir)) {
    copyScriptsFromCurrentProject(sourceScriptsDir, currentScriptsDir);
  } else if (currentDir === path.dirname(scriptDir)) {
    // Если скрипт запускается из текущего проекта, просто информируем пользователя
    log(`ℹ Скрипты task-master уже находятся в правильной директории`, colors.blue);
  } else {
    log(`✗ Не найдена директория с исходными скриптами task-master`, colors.red);
    return false;
  }
  
  // Обновляем package.json
  updatePackageJson();
  
  // Устанавливаем зависимости
  installDependencies();
  
  // Создаем README
  createReadme();
  
  // Инициализируем task-master
  try {
    const initScriptPath = path.join(currentScriptsDir, 'init.js');
    if (fs.existsSync(initScriptPath)) {
      log(`ℹ Инициализация Task Master...`, colors.blue);
      require(initScriptPath);
    } else {
      log(`✗ Не найден скрипт инициализации Task Master`, colors.red);
    }
  } catch (error) {
    log(`✗ Ошибка при инициализации Task Master: ${error.message}`, colors.red);
  }
  
  log(`${colors.bold}${colors.green}✓ Task Master успешно установлен!${colors.reset}`, colors.green);
  
  // Показываем информацию о локальных командах
  log(``, colors.reset);
  log(`${colors.bold}Доступные локальные команды:${colors.reset}`, colors.blue);
  log(`  npm run task-master:init - инициализация системы задач`, colors.reset);
  log(`  npm run task-master:list - показать список задач`, colors.reset);
  log(`  npm run task-master:next - получить следующую задачу`, colors.reset);
  log(`  npm run task-master:generate - сгенерировать задачи из описания`, colors.reset);
  log(`  npm run task-master:complete <id> - отметить задачу как выполненную`, colors.reset);
  log(`  npm run task-master:chat "команда" - выполнить команду через интерфейс чата`, colors.reset);
  
  // Показываем информацию о глобальных командах
  log(``, colors.reset);
  log(`${colors.bold}Для глобальной установки:${colors.reset}`, colors.blue);
  log(`  npm install -g task-master-ai`, colors.reset);
  log(`  После этого вы сможете использовать команды вида:`, colors.reset);
  log(`  task-master [команда] [параметры]`, colors.reset);
  
  // Показываем новые возможности
  showNewFeatures();
  
  return true;
}

// Запускаем установку, если скрипт запущен напрямую
if (require.main === module) {
  install();
}

module.exports = { install };
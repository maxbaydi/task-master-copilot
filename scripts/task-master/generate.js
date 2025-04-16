#!/usr/bin/env node

/**
 * Скрипт для генерации задач из описания
 * Позволяет создавать задачи из текстового описания
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');

// Путь к файлу задач
const tasksFile = path.join(process.cwd(), 'tasks', 'tasks.json');

// Создаем интерфейс для чтения с консоли
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

// Функция для получения нового ID задачи
function getNextTaskId(tasks) {
  if (tasks.length === 0) return 1;
  return Math.max(...tasks.map(task => task.id)) + 1;
}

// Функция для создания задачи из текстового описания
function generateTaskFromDescription(description, tasksData) {
  console.log(chalk.blue('\nАнализируем описание...\n'));
  
  // Разбиваем описание на строки
  const lines = description.split('\n').filter(line => line.trim() !== '');
  
  // Первая строка будет заголовком
  const title = lines[0].trim();
  
  // Определяем подзадачи (строки, начинающиеся с - или *)
  const subtasksLines = lines.slice(1).filter(line => line.trim().match(/^[\-\*]\s+/));
  const subtasks = subtasksLines.map((line, index) => {
    return {
      id: `${getNextTaskId(tasksData.tasks)}.${index + 1}`,
      title: line.trim().replace(/^[\-\*]\s+/, ''),
      status: 'pending'
    };
  });
  
  // Создаем описание из оставшихся строк
  const descLines = lines.slice(1).filter(line => !line.trim().match(/^[\-\*]\s+/));
  const taskDescription = descLines.join('\n').trim() || 'Нет описания';
  
  // Создаем новую задачу
  const newTask = {
    id: getNextTaskId(tasksData.tasks),
    title,
    description: taskDescription,
    status: 'pending',
    priority: 2, // По умолчанию средний приоритет
    subtasks,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  return newTask;
}

// Функция для создания нескольких задач в пакетном режиме
function generateMultipleTasks() {
  const tasksData = loadTasks();
  
  console.log(chalk.bold('\n📝 Пакетная генерация задач\n'));
  console.log(chalk.blue('Введите несколько задач, разделяя их строкой "###".'));
  console.log(chalk.blue('Для каждой задачи первая строка будет заголовком.'));
  console.log(chalk.blue('Строки, начинающиеся с - или *, будут считаться подзадачами.'));
  console.log(chalk.blue('Введите пустую строку для завершения ввода.\n'));
  
  let batchInput = '';
  
  // Рекурсивная функция для чтения многострочного ввода
  function readLines() {
    rl.question('> ', (input) => {
      if (input.trim() === '') {
        if (batchInput.trim() === '') {
          console.log(chalk.yellow('Пустой ввод. Попробуйте ещё раз.'));
          readLines();
          return;
        }
        
        processBatchTasks(batchInput, tasksData);
      } else {
        batchInput += input + '\n';
        readLines();
      }
    });
  }
  
  readLines();
}

// Функция для обработки пакетного ввода задач
function processBatchTasks(batchInput, tasksData) {
  // Разбиваем ввод на отдельные задачи с помощью разделителя "###"
  const taskDescriptions = batchInput.split(/###/).map(desc => desc.trim()).filter(desc => desc);
  
  if (taskDescriptions.length === 0) {
    console.log(chalk.yellow('Не удалось определить задачи в описании. Убедитесь, что вы разделяете задачи символами "###"'));
    rl.close();
    return;
  }
  
  const createdTasks = [];
  
  // Обрабатываем каждую задачу отдельно
  for (const taskDesc of taskDescriptions) {
    // Разбиваем описание на строки
    const lines = taskDesc.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) continue;
    
    // Первая строка будет заголовком
    const title = lines[0].trim();
    
    // Определяем подзадачи (строки, начинающиеся с - или *)
    const subtasksLines = lines.slice(1).filter(line => line.trim().match(/^[\-\*]\s+/));
    
    const taskId = getNextTaskId(tasksData.tasks);
    
    const subtasks = subtasksLines.map((line, index) => {
      return {
        id: `${taskId}.${index + 1}`,
        title: line.trim().replace(/^[\-\*]\s+/, ''),
        status: 'pending'
      };
    });
    
    // Создаем описание из оставшихся строк
    const descLines = lines.slice(1).filter(line => !line.trim().match(/^[\-\*]\s+/));
    const taskDescription = descLines.join('\n').trim() || 'Нет описания';
    
    // Создаем новую задачу
    const newTask = {
      id: taskId,
      title,
      description: taskDescription,
      status: 'pending',
      priority: 2, // По умолчанию средний приоритет
      subtasks,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Добавляем задачу в список
    tasksData.tasks.push(newTask);
    createdTasks.push(newTask);
  }
  
  // Если ни одной задачи не создано
  if (createdTasks.length === 0) {
    console.log(chalk.yellow('Не удалось создать задачи. Проверьте формат ввода.'));
    rl.close();
    return;
  }
  
  // Запрашиваем приоритет для всех задач
  rl.question(chalk.blue('\nУкажите приоритет для всех задач (1 - высокий, 2 - средний, 3 - низкий) [2]: '), (priority) => {
    const priorityValue = parseInt(priority) || 2;
    const normalizedPriority = Math.min(Math.max(priorityValue, 1), 3); // От 1 до 3
    
    // Устанавливаем приоритет для всех созданных задач
    for (const task of createdTasks) {
      task.priority = normalizedPriority;
      
      // Находим задачу в исходном массиве и обновляем приоритет
      const taskIndex = tasksData.tasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) {
        tasksData.tasks[taskIndex].priority = normalizedPriority;
      }
    }
    
    // Сохраняем задачи в файл
    if (saveTasks(tasksData)) {
      console.log(chalk.green(`\n✓ Создано задач: ${createdTasks.length}`));
      
      createdTasks.forEach(task => {
        console.log(chalk.bold(`\n[${task.id}] ${task.title}`));
        console.log(chalk.dim(`  Приоритет: ${task.priority}`));
        if (task.subtasks.length > 0) {
          console.log(chalk.dim(`  Подзадач: ${task.subtasks.length}`));
          task.subtasks.forEach(subtask => {
            console.log(chalk.dim(`    - ${subtask.title}`));
          });
        }
      });
      
      console.log(chalk.green('\n✓ Генерация задач завершена!'));
      console.log(chalk.blue('Используйте npm run task-master:list для просмотра всех задач.'));
      rl.close();
    } else {
      rl.close();
    }
  });
}

// Основная функция создания задач
function generateTasks() {
  const tasksData = loadTasks();
  
  console.log(chalk.bold('\n📝 Генерация задач из описания\n'));
  
  // Спрашиваем режим работы
  rl.question(chalk.blue('Выберите режим работы:\n1 - Создать одну задачу\n2 - Создать несколько задач\nВыбор (1/2): '), (choice) => {
    if (choice === '2') {
      // Запускаем режим создания нескольких задач
      generateMultipleTasks();
      return;
    }
    
    // По умолчанию - режим создания одной задачи
    console.log(chalk.blue('\nВведите описание задачи. Первая строка будет заголовком.'));
    console.log(chalk.blue('Строки, начинающиеся с - или *, будут считаться подзадачами.'));
    console.log(chalk.blue('Введите пустую строку для завершения ввода.\n'));
    
    let description = '';
    
    // Рекурсивная функция для чтения многострочного ввода
    function readLines() {
      rl.question('> ', (input) => {
        if (input.trim() === '') {
          if (description.trim() === '') {
            console.log(chalk.yellow('Пустое описание. Попробуйте ещё раз.'));
            readLines();
            return;
          }
          
          // Создаем задачу из описания
          const newTask = generateTaskFromDescription(description, tasksData);
          
          // Запрашиваем приоритет
          rl.question(chalk.blue('\nУкажите приоритет (1 - высокий, 2 - средний, 3 - низкий) [2]: '), (priority) => {
            const priorityValue = parseInt(priority) || 2;
            newTask.priority = Math.min(Math.max(priorityValue, 1), 3); // От 1 до 3
            
            // Добавляем задачу в список
            tasksData.tasks.push(newTask);
            
            // Сохраняем задачи в файл
            if (saveTasks(tasksData)) {
              console.log(chalk.green(`\n✓ Задача #${newTask.id} "${newTask.title}" успешно создана!`));
              console.log(chalk.dim(`  Приоритет: ${newTask.priority}`));
              console.log(chalk.dim(`  Подзадач: ${newTask.subtasks.length}`));
              
              // Спрашиваем, нужно ли добавить ещё задачу
              rl.question(chalk.blue('\nХотите добавить ещё одну задачу? (y/n) [y]: '), (answer) => {
                if (answer.toLowerCase() !== 'n') {
                  description = '';
                  console.log('\n');
                  readLines();
                } else {
                  console.log(chalk.green('\n✓ Генерация задач завершена!'));
                  console.log(chalk.blue('Используйте npm run task-master:list для просмотра всех задач.'));
                  rl.close();
                }
              });
            } else {
              rl.close();
            }
          });
        } else {
          description += input + '\n';
          readLines();
        }
      });
    }
    
    readLines();
  });
}

// Запуск
generateTasks();
/**
 * Модуль для интеграции с GitHub Copilot
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Путь к файлу контекста для Copilot
const COPILOT_CONTEXT_PATH = path.join(process.cwd(), '.copilot', 'context.md');

/**
 * Сохранить форматированный контекст для GitHub Copilot
 * 
 * @param {Object} task - Информация о задаче
 * @param {Object} contextData - Контекстные данные
 * @returns {boolean} - Успешно ли сохранен контекст
 */
async function saveFormattedCopilotContext(task, contextData = null) {
  try {
    // Создать директорию .copilot, если она не существует
    const copilotDir = path.join(process.cwd(), '.copilot');
    if (!fs.existsSync(copilotDir)) {
      fs.mkdirSync(copilotDir, { recursive: true });
    }
    
    // Форматировать контекст для Copilot
    let formattedContext = `# Задача #${task.id}: ${task.title}\n\n`;
    formattedContext += `## Описание задачи\n${task.description || 'Описание отсутствует'}\n\n`;
    
    if (task.status) {
      formattedContext += `## Статус: ${task.status}\n\n`;
    }
    
    if (task.priority) {
      formattedContext += `## Приоритет: ${task.priority}\n\n`;
    }
    
    if (contextData) {
      formattedContext += `## Дополнительный контекст\n`;
      
      if (contextData.notes && contextData.notes.length > 0) {
        formattedContext += `### Заметки\n`;
        contextData.notes.forEach(note => {
          formattedContext += `- ${note}\n`;
        });
        formattedContext += '\n';
      }
      
      if (contextData.references && contextData.references.length > 0) {
        formattedContext += `### Ссылки\n`;
        contextData.references.forEach(ref => {
          formattedContext += `- ${ref}\n`;
        });
        formattedContext += '\n';
      }
      
      if (contextData.code && contextData.code.length > 0) {
        formattedContext += `### Код\n`;
        contextData.code.forEach(codeSnippet => {
          formattedContext += `\`\`\`${codeSnippet.language || ''}\n${codeSnippet.code}\n\`\`\`\n\n`;
        });
      }
      
      if (contextData.history && contextData.history.length > 0) {
        formattedContext += `### История\n`;
        contextData.history.forEach(historyItem => {
          formattedContext += `- ${historyItem.date || 'Без даты'}: ${historyItem.action}\n`;
        });
        formattedContext += '\n';
      }
    }
    
    // Сохранить контекст
    fs.writeFileSync(COPILOT_CONTEXT_PATH, formattedContext, 'utf8');
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении контекста для Copilot:', error);
    return false;
  }
}

/**
 * Получить сохраненный контекст для GitHub Copilot
 * 
 * @returns {string|null} - Форматированный контекст или null при ошибке
 */
async function getSavedCopilotContext() {
  try {
    if (!fs.existsSync(COPILOT_CONTEXT_PATH)) {
      return null;
    }
    return fs.readFileSync(COPILOT_CONTEXT_PATH, 'utf8');
  } catch (error) {
    console.error('Ошибка при чтении контекста для Copilot:', error);
    return null;
  }
}

/**
 * Выполнить запрос к GitHub Copilot
 * 
 * @param {string} prompt - Запрос для Copilot
 * @returns {string} - Ответ от Copilot
 */
async function queryCopilot(prompt) {
  // Эта функция будет реализована с использованием Copilot API или CLI
  console.log('Запрос к GitHub Copilot:', prompt);
  return 'Это заглушка ответа от GitHub Copilot. Реальная интеграция требует API доступа.';
}

/**
 * Получить продолжение от Copilot для текущего контекста
 * 
 * @param {string} lastContext - Последний контекст или промт
 * @returns {string} - Продолжение от Copilot
 */
async function getCopilotContinuation(lastContext) {
  const context = await getSavedCopilotContext();
  const prompt = context ? `${context}\n\nПродолжи: "${lastContext}"` : `Продолжи: "${lastContext}"`;
  return await queryCopilot(prompt);
}

/**
 * Интегрировать задачу с GitHub Copilot
 * 
 * @param {number} taskId - ID задачи
 * @param {string} actionType - Тип действия (chat, continue, comment)
 * @param {string} prompt - Запрос пользователя
 * @returns {Object} - Результат интеграции
 */
async function integrateWithCopilot(taskId, actionType, prompt = '') {
  // Здесь будет реализована интеграция с Copilot в зависимости от типа действия
  
  switch (actionType) {
    case 'continue':
      return {
        type: 'continuation',
        content: await getCopilotContinuation(prompt)
      };
      
    case 'chat':
      return {
        type: 'chat',
        content: await queryCopilot(prompt)
      };
      
    case 'comment':
      return {
        type: 'comment',
        content: await queryCopilot(`Напиши комментарий к этому коду: ${prompt}`)
      };
      
    default:
      return {
        type: 'error',
        content: 'Неизвестный тип действия для интеграции с Copilot'
      };
  }
}

module.exports = {
  saveFormattedCopilotContext,
  getSavedCopilotContext,
  queryCopilot,
  getCopilotContinuation,
  integrateWithCopilot
};
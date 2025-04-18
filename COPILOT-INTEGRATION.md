# Task Master: Интеграция с GitHub Copilot

Task Master предоставляет расширенные возможности для совместной работы с GitHub Copilot. Этот документ объясняет, как эффективно использовать Task Master в сочетании с Copilot для автоматизации процесса планирования и отслеживания задач.

## Основные сценарии использования

### 1. Автоматическое создание задач из обсуждения

GitHub Copilot может автоматически анализировать обсуждение проекта и создавать соответствующие задачи в Task Master. После обсуждения плана разработки, просто попросите Copilot создать список задач:

```
Создай список задач из нашего обсуждения
```

или

```
Сгенерируй задачи из плана
```

Copilot проанализирует контекст беседы и создаст структурированный список задач с подзадачами, автоматически определит приоритеты и сохранит их в Task Master.

### 2. Пакетное создание задач

Вы можете попросить Copilot создать несколько связанных задач сразу:

```
Создай задачи Разработка функционала авторизации [P:1]
- Создать форму входа
- Реализовать валидацию полей
- Добавить восстановление пароля

###

Интеграция с API [P:2]
- Настроить обработку запросов
- Реализовать обработку ошибок
```

### 3. Отслеживание прогресса

В процессе работы вы можете попросить Copilot показать текущий статус задач:

```
Покажи задачи
```

или отметить задачу как выполненную:

```
Отметь задачу 1 как выполненную
```

### 4. Получение следующей задачи

Когда вы закончили одну задачу и готовы перейти к следующей:

```
Дай следующую задачу
```

## Установка и настройка

1. Установите Task Master глобально:
   ```
   npm install -g task-master-copilot
   ```

2. При работе в новом проекте с GitHub Copilot, инициализируйте Task Master:
   ```
   task-master init
   ```

3. Теперь вы можете использовать все команды Task Master через Copilot.

## Поддерживаемые команды для Copilot

### Продолжить / Продолжить итерацию

- **Описание:** Позволяет отправить текущий контекст задачи в GitHub Copilot и получить продолжение/ответ.
- **Как использовать:** Введите в чат команду `Продолжить` или `Продолжить итерацию`.
- **Что происходит:** Task Master вызывает Copilot с текущим контекстом и возвращает результат пользователю.

**Пример:**
```
Продолжить итерацию
```

**Ожидаемый результат:**
- В ответе появится продолжение от GitHub Copilot, основанное на контексте задачи.

## Шаблон CLI-команд для Copilot

Copilot может управлять Task Master через терминал, используя следующие команды (после глобальной установки):

| Действие                        | Команда для терминала                        | Описание |
|----------------------------------|----------------------------------------------|----------|
| Инициализация Task Master        | task-master init                             | Создать tasks.json и подготовить проект |
| Показать все задачи              | task-master list                             | Вывести список всех задач и их статусы |
| Показать следующую задачу        | task-master next                             | Показать следующую задачу по приоритету |
| Отметить задачу как выполненную  | task-master complete <id>                    | Отметить задачу или подзадачу как выполненную (пример: 1 или 2.1) |
| Создать новую задачу             | task-master generate "Название задачи"       | Добавить новую задачу (можно с описанием и приоритетом) |
| Обновить контекст                | task-master context                          | Обновить контекст задач для Copilot |

### Примеры команд для Copilot

- Чтобы показать все задачи:
  ```
  task-master list
  ```
- Чтобы отметить задачу 3 как выполненную:
  ```
  task-master complete 3
  ```
- Чтобы получить следующую задачу:
  ```
  task-master next
  ```
- Чтобы создать задачу с приоритетом:
  ```
  task-master generate "Добавить авторизацию" --priority=1
  ```

### Инструкция для Copilot

- Если пользователь просит показать задачи — запусти `task-master list`.
- Если пользователь просит завершить задачу — запусти `task-master complete <id>`.
- Если пользователь просит следующую задачу — запусти `task-master next`.
- Если пользователь просит создать задачу — запусти `task-master generate` с текстом задачи.
- После любой команды, если требуется, обнови контекст через `task-master context`.
- Всегда выводи результат выполнения команды в чат.

**Copilot должен запускать эти команды в терминале VS Code и использовать их вывод для дальнейших рекомендаций.**

---

## Что делать Copilot при ошибках

- Если команда task-master (например, complete, list, next, generate) возвращает ошибку (например, "Задача не найдена", "tasks.json не найден" или другая ошибка):
  1. **Не редактируй файл tasks.json вручную.**
  2. Сообщи пользователю о возникшей ошибке и выведи текст ошибки из терминала.
  3. Предложи пользователю проверить список задач через команду `task-master list` или убедиться, что файл tasks.json существует и корректен.
  4. Если проблема не решается — предложи обратиться к документации или поддержке проекта.

**Пример правильного ответа Copilot:**
> Команда `task-master complete 1` завершилась с ошибкой: "Задача с ID 1 не найдена". Проверьте список задач через `task-master list` и убедитесь, что ID указан верно. Я не буду вносить изменения вручную в tasks.json.

---

## Советы по эффективной работе

1. **Начните с плана**: Перед началом работы обсудите с Copilot общую архитектуру и подход к проекту, а затем попросите создать список задач из обсуждения.

2. **Используйте метки приоритетов**: При создании задач указывайте приоритеты, чтобы Copilot мог правильно рекомендовать следующие шаги.

3. **Следуйте шагам**: После создания списка задач, последовательно выполняйте их, используя команду "Дай следующую задачу".

4. **Обновляйте статус**: Регулярно отмечайте выполненные задачи, чтобы поддерживать актуальность плана.

5. **Адаптируйте план**: По мере прогресса, не стесняйтесь просить Copilot модифицировать список задач или добавлять новые задачи.

## Пример рабочего процесса

1. **Планирование проекта**:
   ```
   Обсуждение: Я хочу создать веб-приложение для управления личными финансами с возможностью отслеживания расходов, доходов и формирования отчетов.
   ```

2. **Создание задач**:
   ```
   Создай список задач из нашего обсуждения
   ```

3. **Начало работы**:
   ```
   Дай следующую задачу
   ```

4. **Отметка прогресса**:
   ```
   Отметь задачу 1 как выполненную
   ```

5. **Адаптация плана**:
   ```
   Создай задачу Добавление дополнительной функциональности поиска транзакций
   ```

Task Master и GitHub Copilot вместе создают мощный инструмент для управления разработкой проектов, позволяя вам сосредоточиться на написании кода и решении технических задач.
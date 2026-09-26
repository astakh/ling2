# Настройка GigaChat API

## 1. Регистрация в Studio Сбера

1. Перейдите на https://developers.sber.ru/studio/workspaces
2. Войдите через Сбер ID
3. Создайте рабочее пространство (если ещё нет)

## 2. Получение credentials

1. В рабочем пространстве перейдите в раздел "API ключи"
2. Создайте новый API ключ для GigaChat
3. Скопируйте **Authorization key** (это и есть `GIGACHAT_CREDENTIALS`)

Формат ключа: `Basic <base64-encoded-string>`

## 3. Настройка .env

Откройте `backend/.env` и заполните:

```env
# GigaChat API
GIGACHAT_CREDENTIALS=Basic ваш_ключ_тут
GIGACHAT_MODEL=GigaChat
GIGACHAT_API_URL=https://gigachat.devices.sberbank.ru/api/v1
```

### Модели GigaChat:

- `GigaChat` — базовая модель (быстрая, дешёвая)
- `GigaChat-Plus` — улучшенная модель
- `GigaChat-Pro` — максимальное качество

## 4. Проверка работы

После настройки перезапустите backend:

```powershell
cd D:\ling2\backend
.\venv\Scripts\Activate.ps1
python main.py
```

В логах вы должны увидеть:
```
[GigaChat] Access token obtained successfully
```

## 5. Тарификация

GigaChat предоставляет бесплатные токены для тестирования.
Актуальные тарифы: https://developers.sber.ru/docs/ru/gigachat/api/tariffs

## Troubleshooting

### Ошибка 401 Unauthorized
- Проверьте, что `GIGACHAT_CREDENTIALS` начинается с `Basic `
- Убедитесь, что ключ не истёк

### Ошибка подключения
- Проверьте доступ к `https://gigachat.devices.sberbank.ru`
- Убедитесь, что firewall не блокирует HTTPS

### Пустой ответ от LLM
- Проверьте, что в рабочем пространстве активирован доступ к GigaChat API
- Попробуйте другую модель (GigaChat-Plus)

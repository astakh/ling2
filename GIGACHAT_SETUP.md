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
GIGACHAT_OAUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_URL=https://api.giga.chat/v1
GIGACHAT_SCOPE=GIGACHAT_API_PERS
```

### Параметры:

**GIGACHAT_CREDENTIALS**
- Authorization key из личного кабинета Studio
- Формат: `Basic <base64>`

**GIGACHAT_MODEL**
- `GigaChat` — базовая модель (быстрая, дешёвая)
- `GigaChat-Plus` — улучшенная модель
- `GigaChat-Pro` — максимальное качество
- `GigaChat-2-Max` — новейшая модель (рекомендуется)
- `GigaChat-3-Ultra` — только для физлиц во freemium

**GIGACHAT_OAUTH_URL**
- URL для получения токена доступа
- По умолчанию: `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`

**GIGACHAT_API_URL**
- URL для API запросов (chat completions)
- По умолчанию: `https://api.giga.chat/v1`

**GIGACHAT_SCOPE**
- `GIGACHAT_API_PERS` — для физических лиц
- `GIGACHAT_API_B2B` — для ИП и юрлиц (платные пакеты)
- `GIGACHAT_API_CORP` — для ИП и юрлиц (pay-as-you-go)

## 4. Как работает авторизация

### Шаг 1: Получение токена доступа

```
POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth

Headers:
  Authorization: Basic <credentials>
  RqUID: <uuid4>
  Content-Type: application/x-www-form-urlencoded
  Accept: application/json

Body:
  scope=GIGACHAT_API_PERS

Response:
  {
    "access_token": "eyJhbGci...",
    "expires_at": 1739784663483  // unix timestamp в миллисекундах
  }
```

Токен действителен **30 минут**.

### Шаг 2: Использование токена

```
POST https://api.giga.chat/v1/chat/completions

Headers:
  Authorization: Bearer <access_token>
  Content-Type: application/json
  Accept: application/json
  User-Agent: LingoFlow/1.0

Body:
  {
    "model": "GigaChat",
    "messages": [...],
    "temperature": 0.7
  }
```

## 5. Проверка работы

После настройки перезапустите backend:

```powershell
cd D:\ling2\backend
.\venv\Scripts\Activate.ps1
python main.py
```

В логах вы должны увидеть:
```
[GigaChat] Requesting new access token...
[GigaChat] Access token obtained successfully, expires at 2024-...
```

При начале урока:
```
[GigaChat] Generating sentences for 2 word groups
[GigaChat] Generated 2 sentences
```

## 6. Тарификация

GigaChat предоставляет бесплатные токены для тестирования.
Актуальные тарифы: https://developers.sber.ru/docs/ru/gigachat/tariffs/individual-tariffs

## Troubleshooting

### Ошибка SSL сертификата
Сбер использует самоподписанные сертификаты. В коде уже добавлен параметр `verify=False` для httpx.

Если видите ошибку `SSL: CERTIFICATE_VERIFY_FAILED`:
- Установите сертификат НУЦ Минцифры: https://developers.sber.ru/docs/ru/gigachat/certificates
- Или оставьте `verify=False` в коде (небезопасно для production)

### Ошибка 401 Unauthorized
- Проверьте, что `GIGACHAT_CREDENTIALS` начинается с `Basic `
- Убедитесь, что ключ не истёк
- Проверьте, что в рабочем пространстве активирован доступ к GigaChat API

### Ошибка подключения к OAuth
- Проверьте доступ к `https://ngw.devices.sberbank.ru:9443`
- Убедитесь, что firewall не блокирует HTTPS
- Возможно, нужен сертификат НУЦ Минцифры: https://developers.sber.ru/docs/ru/gigachat/certificates

### Ошибка подключения к API
- Проверьте доступ к `https://api.giga.chat`
- Убедитесь, что токен получен успешно

### Пустой ответ от LLM
- Проверьте логи backend
- Попробуйте другую модель (GigaChat-2-Max)
- Убедитесь, что в рабочем пространстве есть токены

### Ошибка парсинга JSON
- В логах будет: `[GigaChat] Could not parse JSON`
- Это нормально, есть fallback логика
- Попробуйте добавить в промпт: "Верни ТОЛЬКО JSON"

## Ссылки

- Документация: https://developers.sber.ru/docs/ru/gigachat/api
- Получение токена: https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/post-token
- Chat completions: https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/post-chat
- Модели: https://developers.sber.ru/docs/ru/gigachat/models/main
- Тарифы: https://developers.sber.ru/docs/ru/gigachat/tariffs/individual-tariffs
- Сертификаты: https://developers.sber.ru/docs/ru/gigachat/certificates

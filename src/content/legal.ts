import type { AppLocale } from '../i18n/localeStore';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

const privacyRu: LegalDocument = {
  title: 'Политика конфиденциальности',
  updated: '10 июня 2026',
  sections: [
    {
      heading: 'Кто мы',
      paragraphs: [
        'Tips from trips — веб-сервис для ведения личной карты путешествий (города, места, маршруты). Оператор сервиса: Михаил Чернышёв. Контакт: tipsfromtripsapp@gmail.com, Telegram @mishachernyshev.',
      ],
    },
    {
      heading: 'Какие данные собираем',
      paragraphs: [
        'При входе через Google: имя, email, аватар, идентификатор Google.',
        'Данные профиля: юзернейм, настройки видимости карты и тип подписки.',
        'Контент карты: города, места, маршруты, загруженные фотографии, тексты описаний.',
        'Технические данные: IP-адрес и заголовки запросов при обращении к API (для безопасности и лимитов).',
        'Обратная связь: имя, email и текст сообщения, если вы отправляете форму на сайте.',
      ],
    },
    {
      heading: 'Зачем используем',
      paragraphs: [
        'Для создания и отображения вашей карты, авторизации, ограничений тарифа Freemium, избранного и поиска пользователей.',
        'Для ответа на обращения в поддержку.',
        'Для защиты от злоупотреблений (rate limiting).',
      ],
    },
    {
      heading: 'Кому показываем',
      paragraphs: [
        'Публичный профиль и карта — согласно настройке видимости (публичная или только для владельца). Email в публичном профиле не отображается.',
        'Данные не продаём третьим лицам. Хостинг API — Fly.io; фронтенд — GitHub Pages; авторизация — Google OAuth.',
      ],
    },
    {
      heading: 'Хранение и удаление',
      paragraphs: [
        'Данные хранятся на сервере в базе SQLite и на диске (фотографии), пока вы пользуетесь сервисом.',
        'Удалить аккаунт и все связанные данные можно в настройках аккаунта на сайте или по запросу на tipsfromtripsapp@gmail.com.',
      ],
    },
    {
      heading: 'Cookies и localStorage',
      paragraphs: [
        'Сессия входа хранится в HttpOnly cookie на сервере API (недоступна JavaScript). localStorage используется для языка интерфейса и подсказок онбординга. Рекламных cookies нет.',
      ],
    },
  ],
};

const privacyEn: LegalDocument = {
  title: 'Privacy Policy',
  updated: 'June 10, 2026',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        'Tips from trips is a web service for a personal travel map (cities, places, routes). Operator: Mikhail Chernyshev. Contact: tipsfromtripsapp@gmail.com, Telegram @mishachernyshev.',
      ],
    },
    {
      heading: 'Data we collect',
      paragraphs: [
        'Google sign-in: name, email, avatar, Google account id.',
        'Profile: username, map visibility settings, subscription tier.',
        'Map content: cities, places, routes, uploaded photos, descriptions.',
        'Technical: IP address and request metadata for security and rate limits.',
        'Feedback form: name, email, and message text when you contact us.',
      ],
    },
    {
      heading: 'Why we use it',
      paragraphs: [
        'To run your map, authentication, Freemium limits, favorites, and user search.',
        'To respond to support messages.',
        'To prevent abuse (rate limiting).',
      ],
    },
    {
      heading: 'Who can see it',
      paragraphs: [
        'Public profile and map depend on your visibility setting (public or owner-only). Email is not shown on public profiles.',
        'We do not sell data. API hosting: Fly.io; frontend: GitHub Pages; auth: Google OAuth.',
      ],
    },
    {
      heading: 'Retention and deletion',
      paragraphs: [
        'Data is stored on the server (SQLite and uploaded files) while you use the service.',
        'You can delete your account and all related data in account settings on the site, or by emailing tipsfromtripsapp@gmail.com.',
      ],
    },
    {
      heading: 'Cookies and localStorage',
      paragraphs: [
        'Sign-in session is stored in an HttpOnly cookie on the API server (not accessible to JavaScript). localStorage is used for UI language and onboarding hints. No ad cookies.',
      ],
    },
  ],
};

const termsRu: LegalDocument = {
  title: 'Пользовательское соглашение',
  updated: '10 июня 2026',
  sections: [
    {
      heading: 'Принятие условий',
      paragraphs: [
        'Используя Tips from trips, вы соглашаетесь с этим соглашением и политикой конфиденциальности. Если не согласны — не пользуйтесь сервисом.',
      ],
    },
    {
      heading: 'Сервис',
      paragraphs: [
        'Сервис предоставляется «как есть». Мы стремимся к стабильной работе, но не гарантируем бесперебойный доступ и сохранность данных без резервного копирования с вашей стороны.',
        'Витрина на главной странице — пример карты администратора. Личная карта создаётся после входа через Google.',
      ],
    },
    {
      heading: 'Аккаунт и контент',
      paragraphs: [
        'Вы отвечаете за содержимое своей карты и соблюдение применимого законодательства.',
        'Запрещено размещать: материалы с сексуальным насилием над детями (CSAM); откровенный сексуальный контент (18+) в публично доступных картах; насилие и экстремизм; разжигание ненависти; публикацию чужих персональных или интимных данных без согласия; спам, фишинг и попытки взлома сервиса.',
        'Юзернейм выбираете вы; мы можем освободить имя при нарушении правил или по жалобе.',
        'Загружая фото и тексты, вы подтверждаете право их публиковать в рамках выбранной видимости карты.',
      ],
    },
    {
      heading: 'Жалобы на контент',
      paragraphs: [
        'Если вы видите неприемлемое место на чужой карте, нажмите «Пожаловаться» в карточке этого места и укажите причину. Жалоба уходит оператору на tipsfromtripsapp@gmail.com.',
        'Мы рассматриваем жалобы в разумный срок (обычно до 48 часов). При подтверждённом нарушении контент удаляется, аккаунт может быть ограничен или заблокирован.',
        'Материалы с участием несовершеннолетней сексуальной эксплуатации удаляются немедленно; при необходимости сведения передаются в компетентные органы.',
        'Альтернативно можно написать на tipsfromtripsapp@gmail.com или в Telegram @mishachernyshev, указав ссылку на карту и название места.',
      ],
    },
    {
      heading: 'Тарифы',
      paragraphs: [
        'Freemium: лимиты на число стран, городов, маршрутов и мест (см. аккаунт). Premium снимает лимиты; оплата будет доступна позже.',
        'Мы можем менять лимиты и цены с уведомлением на сайте.',
      ],
    },
    {
      heading: 'Ограничение ответственности',
      paragraphs: [
        'Сервис не является туристической рекомендацией. Маршруты и места — личные заметки пользователей.',
        'Максимальная ответственность ограничена суммой, уплаченной вами за подписку за последние 12 месяцев (если применимо).',
      ],
    },
    {
      heading: 'Контакты',
      paragraphs: [
        'Вопросы и жалобы: tipsfromtripsapp@gmail.com или Telegram @mishachernyshev.',
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  title: 'Terms of Service',
  updated: 'June 10, 2026',
  sections: [
    {
      heading: 'Acceptance',
      paragraphs: [
        'By using Tips from trips you agree to these terms and our Privacy Policy. If you disagree, do not use the service.',
      ],
    },
    {
      heading: 'The service',
      paragraphs: [
        'The service is provided "as is". We aim for stability but do not guarantee uninterrupted access.',
        'The homepage showcase is an example admin map. Your personal map is created after Google sign-in.',
      ],
    },
    {
      heading: 'Account and content',
      paragraphs: [
        'You are responsible for your map content and compliance with applicable laws.',
        'Prohibited content includes: child sexual abuse material (CSAM); explicit sexual content (18+) on publicly accessible maps; violence and extremism; hate speech; publishing others\' personal or intimate data without consent; spam, phishing, and attempts to compromise the service.',
        'You choose your username; we may reclaim it for policy violations.',
        'By uploading photos and text you confirm you may publish them under your visibility settings.',
      ],
    },
    {
      heading: 'Content reports',
      paragraphs: [
        'If you see unacceptable content on someone else\'s map, use Report in that place\'s card and select a reason. Reports are sent to tipsfromtripsapp@gmail.com.',
        'We review reports within a reasonable time (typically within 48 hours). Confirmed violations are removed; accounts may be restricted or banned.',
        'Child sexual abuse material is removed immediately and may be reported to competent authorities where required by law.',
        'You may also email tipsfromtripsapp@gmail.com or Telegram @mishachernyshev with the map link and place name.',
      ],
    },
    {
      heading: 'Plans',
      paragraphs: [
        'Freemium has limits on countries, cities, routes, and places (see Account). Premium removes limits; paid upgrade coming later.',
        'We may change limits and pricing with notice on the site.',
      ],
    },
    {
      heading: 'Liability',
      paragraphs: [
        'The service is not travel advice. Routes and places are personal user notes.',
        'Liability is limited to fees paid for subscription in the last 12 months, if any.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions: tipsfromtripsapp@gmail.com or Telegram @mishachernyshev.',
      ],
    },
  ],
};

export function getLegalDocument(
  locale: AppLocale,
  kind: 'privacy' | 'terms',
): LegalDocument {
  if (kind === 'privacy') return locale === 'en' ? privacyEn : privacyRu;
  return locale === 'en' ? termsEn : termsRu;
}

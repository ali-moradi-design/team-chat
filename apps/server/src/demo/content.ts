/** Demo workspace content. Persian and English are mixed on purpose (each message uses dir="auto"). */
export const DEMO_PASSWORD = 'demo-pass-1234';

export interface DemoUser {
  name: string;
  handle: string;
  admin?: boolean;
}

export const DEMO_USERS: DemoUser[] = [
  { name: 'Ali Moradi', handle: 'ali', admin: true },
  { name: 'Sara Lindqvist', handle: 'sara' },
  { name: 'Omid Karimi', handle: 'omid' },
  { name: 'Mina Haddad', handle: 'mina' },
  { name: 'Jonas Weber', handle: 'jonas' },
  { name: 'لیلا رحیمی', handle: 'leila' },
];

export const BOT = { name: 'Echo Bot', handle: 'echo' };

export interface DemoMessage {
  by: string;
  text: string;
  minutesAgo: number;
  reactions?: Array<[emoji: string, by: string[]]>;
  pinned?: boolean;
  replies?: Array<{ by: string; text: string; minutesAfter: number }>;
}

export interface DemoChannel {
  name: string;
  topic: string;
  isPrivate?: boolean;
  members: string[];
  messages: DemoMessage[];
}

const H = 60;
const D = 24 * 60;

export const DEMO_CHANNELS: DemoChannel[] = [
  {
    name: 'general',
    topic: 'Company-wide announcements and chatter',
    members: ['ali', 'sara', 'omid', 'mina', 'jonas', 'leila', 'echo'],
    messages: [
      {
        by: 'ali',
        text: 'Welcome to **Northwind**! This is the demo workspace for Team Chat. Say hi 👋',
        minutesAgo: 2 * D + 5 * H,
        pinned: true,
        reactions: [
          ['🎉', ['sara', 'omid', 'mina']],
          ['👍', ['jonas']],
        ],
      },
      {
        by: 'sara',
        text: 'Hi everyone! Glad to be here. Where do we keep the launch checklist?',
        minutesAgo: 2 * D + 4 * H,
      },
      {
        by: 'ali',
        text: 'Pinned in #launch-2026. Use `@channel` only for things that really need everyone.',
        minutesAgo: 2 * D + 3 * H,
      },
      {
        by: 'leila',
        text: 'سلام به همه! خوشحالم که اینجا هستم 🌷',
        minutesAgo: D + 6 * H,
        reactions: [['❤️', ['ali', 'sara']]],
      },
      {
        by: 'omid',
        text: 'Reminder: all-hands at 16:00. Notes will be posted here afterwards.',
        minutesAgo: D + 2 * H,
        replies: [
          { by: 'mina', text: 'Can we get a recording this time?', minutesAfter: 5 },
          { by: 'omid', text: 'Yes, link will be in this thread.', minutesAfter: 12 },
        ],
      },
      {
        by: 'jonas',
        text: 'The coffee machine on floor 2 is fixed ☕',
        minutesAgo: 5 * H,
        reactions: [['🚀', ['sara', 'omid', 'leila', 'mina']]],
      },
      {
        by: 'sara',
        text: 'Shipping the new onboarding flow today. Feedback welcome in #design-team.',
        minutesAgo: 90,
      },
    ],
  },
  {
    name: 'design-team',
    topic: 'Weekly design sync, specs and reviews',
    members: ['ali', 'sara', 'omid', 'mina', 'echo'],
    messages: [
      {
        by: 'sara',
        text: 'Pushed the new **onboarding flow** to staging. Can someone check the empty states?',
        minutesAgo: 3 * H,
        reactions: [
          ['👍', ['ali', 'omid']],
          ['🎉', ['mina']],
          ['👀', ['ali']],
        ],
      },
      {
        by: 'mina',
        text: 'Here is the updated moodboard for the launch page. I went warmer: amber on deep brown.',
        minutesAgo: 150,
      },
      {
        by: 'omid',
        text: '@ali checked it on mobile, the sidebar drawer looks great. One bug: the `retry` button overlaps the toast.',
        minutesAgo: 140,
        replies: [
          { by: 'ali', text: 'Thanks! Can you attach a screenshot?', minutesAfter: 3 },
          { by: 'omid', text: 'Sure, one sec.', minutesAfter: 5 },
          { by: 'sara', text: 'I can reproduce it on a 360px viewport as well.', minutesAfter: 9 },
        ],
      },
      {
        by: 'mina',
        text: 'یک نکته: در حالت راست‌به‌چپ، آیکون پاسخ باید برعکس شود. بررسی می‌کنید؟',
        minutesAgo: 100,
        reactions: [['👍', ['sara', 'ali']]],
      },
      {
        by: 'ali',
        text: 'Good catch. Logical CSS properties everywhere, no `left`/`right`. I will double check the thread panel.',
        minutesAgo: 70,
      },
      {
        by: 'sara',
        text: 'Typography proposal: Inter for Latin, Vazirmatn for Persian. Both variable fonts.',
        minutesAgo: 35,
        pinned: true,
      },
    ],
  },
  {
    name: 'engineering',
    topic: 'Builds, bugs and architecture',
    members: ['ali', 'omid', 'jonas', 'leila', 'echo'],
    messages: [
      {
        by: 'jonas',
        text: 'CI is green again. The flaky test was a race in the reconnect logic.',
        minutesAgo: 8 * H,
        reactions: [['🚀', ['omid', 'ali']]],
      },
      {
        by: 'omid',
        text: 'Index review for messages:\n```js\ndb.messages.createIndex({ conversationId: 1, threadRootId: 1, _id: -1 })\n```\nHistory pages are now a pure index range scan.',
        minutesAgo: 5 * H,
      },
      {
        by: 'leila',
        text: 'آیا برای جستجو از text index استفاده می‌کنیم یا Atlas Search؟',
        minutesAgo: 4 * H,
      },
      {
        by: 'ali',
        text: '@leila text index with `default_language: none`. Works for Persian and English without stemming surprises.',
        minutesAgo: 4 * H - 10,
        replies: [{ by: 'leila', text: 'عالی، پس نیازی به سرویس جدا نیست.', minutesAfter: 4 }],
      },
      {
        by: 'jonas',
        text: '@ali the Redis adapter is optional via a Compose profile. Single node is the default.',
        minutesAgo: 60,
      },
    ],
  },
  {
    name: 'launch-2026',
    topic: 'Everything for the launch',
    members: ['ali', 'sara', 'mina', 'omid'],
    messages: [
      {
        by: 'ali',
        text: '**Launch checklist**\n- [x] Auth + refresh rotation\n- [x] Threads and reactions\n- [ ] Final copy review\n- [ ] Load test',
        minutesAgo: D + 30,
        pinned: true,
      },
      { by: 'mina', text: 'Final copy review is booked for Thursday.', minutesAgo: 20 * H },
      {
        by: 'omid',
        text: '@channel load test results are in: p95 send latency 38 ms with 200 concurrent sockets.',
        minutesAgo: 45,
        reactions: [['🎉', ['ali', 'sara', 'mina']]],
      },
    ],
  },
  {
    name: 'random',
    topic: 'Memes, music and lunch plans',
    members: ['ali', 'sara', 'omid', 'mina', 'jonas', 'leila', 'echo'],
    messages: [
      {
        by: 'jonas',
        text: 'Anyone up for lunch? New ramen place opened nearby 🍜',
        minutesAgo: 6 * H,
        reactions: [['👀', ['sara']]],
      },
      { by: 'leila', text: 'من هستم! ساعت ۱۲:۳۰ خوبه؟', minutesAgo: 6 * H - 4 },
    ],
  },
  {
    name: 'leadership',
    topic: 'Private: hiring and budget',
    isPrivate: true,
    members: ['ali', 'sara'],
    messages: [
      { by: 'ali', text: 'Two offers out this week. Details in the doc.', minutesAgo: D },
      { by: 'sara', text: 'Great, I will review the budget sheet tonight.', minutesAgo: D - 20 },
    ],
  },
];

export const DEMO_DMS: Array<{
  with: [string, string];
  messages: Array<{ by: string; text: string; minutesAgo: number }>;
}> = [
  {
    with: ['ali', 'sara'],
    messages: [
      {
        by: 'sara',
        text: 'Do you have 10 minutes to look at the onboarding copy?',
        minutesAgo: 55,
      },
      { by: 'ali', text: 'Sure, give me five.', minutesAgo: 50 },
      { by: 'sara', text: 'Thanks! 🙏', minutesAgo: 48 },
    ],
  },
  {
    with: ['ali', 'omid'],
    messages: [
      {
        by: 'omid',
        text: 'Pushed the fix for the toast overlap. Mind a quick review?',
        minutesAgo: 12,
      },
    ],
  },
];

export const BOT_LINES = {
  en: [
    'Tip: select text and press **Ctrl+B** for bold, or wrap it in `backticks` for code.',
    'Did you know? Press **Ctrl+K** to jump to any channel or person.',
    'Friendly reminder to drink some water 💧',
    'Fun fact: this app keeps your place with a "New messages" divider. Scroll up, I will wait.',
    'Try reacting to a message with 🎉 and watch it update live.',
  ],
  fa: [
    'نکته: با دو ستاره دور کلمه (**مثل این**) متن را پررنگ کنید.',
    'می‌دانستید؟ با Ctrl+K می‌توانید سریع به هر کانال بروید.',
    'یادآوری مهربانانه: کمی آب بنوشید 💧',
  ],
};

export const BOT_REPLIES = {
  en: [
    'Hi! I am Echo, the demo bot. Mention me and I will answer 🤖',
    'Got it! Thanks for the ping.',
    'Pong! Everything is running fine.',
  ],
  fa: ['سلام! من اکو هستم، بات نمایشی. اسمم را صدا بزنید 🤖'],
};

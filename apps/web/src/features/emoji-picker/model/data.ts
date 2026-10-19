/** Compact built-in emoji set (no runtime dependency). Format: "emoji keyword keyword". */
export interface EmojiCategory {
  id: string;
  icon: string;
  items: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    icon: '😀',
    items: [
      '😀 grin smile happy', '😃 smile happy', '😄 laugh happy', '😁 beam grin', '😆 laugh', '😅 sweat laugh', '🤣 rofl lol', '😂 joy tears lol',
      '🙂 slight smile', '🙃 upside down', '😉 wink', '😊 blush smile', '😇 angel halo', '🥰 love hearts', '😍 heart eyes love', '🤩 star struck wow',
      '😘 kiss', '😗 kiss', '😚 kiss', '😋 yum tasty', '😛 tongue', '😜 wink tongue', '🤪 zany crazy', '😝 tongue squint',
      '🤗 hug', '🤭 oops giggle', '🤫 shush quiet', '🤔 think hmm', '🫡 salute', '🤐 zipper', '😐 neutral', '😑 expressionless',
      '😶 silent', '😏 smirk', '😒 unamused', '🙄 eyeroll', '😬 grimace', '😮‍💨 exhale relief', '🤥 lying', '😌 relieved',
      '😔 sad pensive', '😪 sleepy', '🤤 drool', '😴 sleep zzz', '😷 mask sick', '🤒 fever sick', '🤕 hurt bandage', '🤢 nauseated',
      '🤮 vomit', '🥵 hot', '🥶 cold', '🥴 woozy', '😵 dizzy', '🤯 mind blown', '🤠 cowboy', '🥳 party celebrate',
      '😎 cool sunglasses', '🤓 nerd', '🧐 monocle', '😕 confused', '😟 worried', '🙁 frown', '😮 surprised wow', '😯 hushed',
      '😲 astonished', '😳 flushed', '🥺 pleading', '😦 frown', '😨 fearful', '😰 anxious sweat', '😢 cry sad', '😭 sob cry',
      '😱 scream', '😖 confounded', '😞 disappointed', '😓 downcast sweat', '😩 weary', '😫 tired', '🥱 yawn', '😤 triumph steam',
      '😡 angry rage', '😠 angry', '🤬 swearing', '😈 devil', '💀 skull dead', '💩 poop', '🤡 clown', '👻 ghost',
    ],
  },
  {
    id: 'people',
    icon: '👍',
    items: [
      '👍 thumbs up yes like', '👎 thumbs down no dislike', '👌 ok perfect', '🤌 pinched', '✌️ victory peace', '🤞 fingers crossed luck', '🤟 love you', '🤘 rock',
      '🤙 call me', '👈 left', '👉 right', '👆 up', '👇 down', '☝️ point up', '✋ stop hand', '🤚 raised back',
      '🖐️ splayed', '👋 wave hello bye', '🤝 handshake deal', '🙏 pray thanks please', '👏 clap applause', '🙌 raised hands hooray', '👐 open hands', '🤲 palms up',
      '💪 strong muscle', '🦾 robot arm', '✍️ writing', '🤳 selfie', '💅 nails', '👀 eyes look', '👁️ eye', '🧠 brain',
      '🫶 heart hands', '🫰 snap', '🫵 you', '🙋 raise hand', '🤷 shrug', '🤦 facepalm', '🙇 bow', '💁 info',
      '🧑‍💻 developer coder', '👩‍💻 woman developer', '👨‍💻 man developer', '🧑‍🎨 artist designer', '🧑‍🚀 astronaut', '🦸 hero', '🧙 mage wizard', '🧑‍🍳 cook chef',
    ],
  },
  {
    id: 'hearts',
    icon: '❤️',
    items: [
      '❤️ red heart love', '🧡 orange heart', '💛 yellow heart', '💚 green heart', '💙 blue heart', '💜 purple heart', '🖤 black heart', '🤍 white heart',
      '🤎 brown heart', '💔 broken heart', '❣️ heart exclamation', '💕 two hearts', '💞 revolving hearts', '💓 beating heart', '💗 growing heart', '💖 sparkling heart',
      '💘 cupid arrow', '💝 gift heart', '💯 hundred perfect', '💢 anger', '💥 boom collision', '💫 dizzy star', '💦 sweat drops', '💨 dash wind',
      '🔥 fire hot lit', '✨ sparkles magic', '⭐ star', '🌟 glowing star', '⚡ zap lightning', '🌈 rainbow', '☀️ sun', '🌙 moon',
    ],
  },
  {
    id: 'nature',
    icon: '🐶',
    items: [
      '🐶 dog', '🐱 cat', '🐭 mouse', '🐹 hamster', '🐰 rabbit', '🦊 fox', '🐻 bear', '🐼 panda',
      '🐨 koala', '🐯 tiger', '🦁 lion', '🐮 cow', '🐷 pig', '🐸 frog', '🐵 monkey', '🙈 see no evil',
      '🙉 hear no evil', '🙊 speak no evil', '🐔 chicken', '🐧 penguin', '🐦 bird', '🦆 duck', '🦉 owl', '🦄 unicorn',
      '🐝 bee', '🦋 butterfly', '🐌 snail', '🐢 turtle', '🐙 octopus', '🐬 dolphin', '🐳 whale', '🦈 shark',
      '🌵 cactus', '🌲 tree', '🌴 palm', '🌱 seedling', '🍀 clover luck', '🌸 blossom', '🌹 rose', '🌻 sunflower',
    ],
  },
  {
    id: 'food',
    icon: '🍕',
    items: [
      '🍎 apple', '🍊 orange', '🍋 lemon', '🍌 banana', '🍉 watermelon', '🍇 grapes', '🍓 strawberry', '🥑 avocado',
      '🍅 tomato', '🥕 carrot', '🌽 corn', '🥐 croissant', '🍞 bread', '🧀 cheese', '🍳 egg', '🥞 pancakes',
      '🍔 burger', '🍟 fries', '🍕 pizza', '🌭 hotdog', '🌮 taco', '🌯 burrito', '🍜 ramen noodles', '🍣 sushi',
      '🍦 ice cream', '🍩 donut', '🍪 cookie', '🎂 cake birthday', '🍫 chocolate', '🍿 popcorn', '☕ coffee', '🍵 tea',
      '🍺 beer', '🍻 cheers', '🥂 champagne toast', '🍷 wine', '🥤 soda', '🧃 juice', '💧 water drop', '🧊 ice',
    ],
  },
  {
    id: 'activity',
    icon: '⚽',
    items: [
      '⚽ soccer football', '🏀 basketball', '🏈 football', '⚾ baseball', '🎾 tennis', '🏐 volleyball', '🏓 ping pong', '🎱 billiards',
      '🏆 trophy win', '🥇 gold medal first', '🥈 silver', '🥉 bronze', '🎯 target bullseye', '🎮 game controller', '🎲 dice', '🧩 puzzle',
      '🎸 guitar', '🎹 piano', '🥁 drum', '🎧 headphones', '🎤 microphone', '🎬 movie clapper', '🎨 art palette', '🎭 theater',
      '🚀 rocket launch ship', '✈️ airplane', '🚗 car', '🚲 bike', '🏠 home', '🏢 office building', '🌍 earth world', '🗺️ map',
    ],
  },
  {
    id: 'objects',
    icon: '💡',
    items: [
      '💻 laptop computer', '🖥️ desktop', '⌨️ keyboard', '🖱️ mouse', '📱 phone', '📷 camera', '🔋 battery', '🔌 plug',
      '💡 idea bulb', '🔦 flashlight', '📚 books', '📖 book', '📝 memo note', '📎 paperclip', '📌 pin', '📍 location pin',
      '📅 calendar', '⏰ alarm clock', '⌛ hourglass', '🔒 lock', '🔓 unlock', '🔑 key', '🛠️ tools', '🔧 wrench',
      '⚙️ gear settings', '🧪 test tube', '🔬 microscope', '📦 package box', '📈 chart up', '📉 chart down', '📊 bar chart', '🧾 receipt',
      '💰 money bag', '💳 credit card', '🎁 gift', '🎈 balloon', '🎉 party popper tada', '🎊 confetti', '🔔 bell', '📣 megaphone announce',
      '✅ check done', '❌ cross no', '⚠️ warning', '🚫 prohibited', '❓ question', '❗ exclamation', '➕ plus', '➖ minus',
      '🐛 bug', '🧹 broom clean', '🧯 extinguisher', '🪄 magic wand', '🏁 finish flag', '🚧 construction', '♻️ recycle', '🔗 link',
    ],
  },
];

export interface EmojiEntry {
  emoji: string;
  keywords: string;
}

export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) =>
  c.items.map((raw) => {
    const [emoji = '', ...kw] = raw.split(' ');
    return { emoji, keywords: kw.join(' ') };
  }),
);

export function searchEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_EMOJI.filter((e) => e.keywords.includes(q)).slice(0, 64);
}

const RECENT_KEY = 'tc:recent-emoji';
export function getRecentEmoji(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).slice(0, 16);
  } catch {
    return [];
  }
}
export function pushRecentEmoji(emoji: string): void {
  try {
    const next = [emoji, ...getRecentEmoji().filter((e) => e !== emoji)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

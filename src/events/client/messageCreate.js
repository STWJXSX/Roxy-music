const { Logger, EmbedFactory } = require('../../utils');
const config = require('../../config');
const chalk = require('chalk');

// Multiple prefixes (case insensitive)
const PREFIXES = ['!', 'roxy ', 'r '];

// ============ IA MENTION CONFIG ============
const REQUIRE_PREMIUM = false;        // true = solo premium, false = todos con límite
const MESSAGES_PER_HOUR = 5;         // Límites por hora si REQUIRE_PREMIUM = false
// ============================================

// Rate limit ultra liviano (solo memoria)
const rateLimitCache = new Map();
let lastCleanup = Date.now();

function checkRateLimit(userId) {
  const now = Date.now();
  const hourMs = 3600000;
  
  if (now - lastCleanup > hourMs) {
    rateLimitCache.clear();
    lastCleanup = now;
  }
  
  const userData = rateLimitCache.get(userId);
  
  if (!userData) {
    rateLimitCache.set(userId, { count: 1, resetAt: now + hourMs });
    return { allowed: true, remaining: MESSAGES_PER_HOUR - 1 };
  }
  
  if (now > userData.resetAt) {
    rateLimitCache.set(userId, { count: 1, resetAt: now + hourMs });
    return { allowed: true, remaining: MESSAGES_PER_HOUR - 1 };
  }
  
  if (userData.count >= MESSAGES_PER_HOUR) {
    const minutesLeft = Math.ceil((userData.resetAt - now) / 60000);
    return { allowed: false, remaining: 0, minutesLeft };
  }
  
  userData.count++;
  return { allowed: true, remaining: MESSAGES_PER_HOUR - userData.count };
}

// Sistema Premium (lazy load) - usar utilidades locales
let premiumUtils = null;

// IA Handler (lazy load)
let callRoxyAI = null;

// ID del bot Roxy para verificación de premium
const ROXY_BOT_ID = '1308187740092764200';

async function loadDependencies() {
  if (premiumUtils === null) {
    try {
      premiumUtils = require('../../utils/premiumUtils');
      console.log('[ROXY] Premium utils loaded successfully');
    } catch (e) {
      console.error('[ROXY] Error loading premium utils:', e.message);
      premiumUtils = {
        checkPremiumAccess: async () => ({ hasPremium: false }),
        checkUserPremium: async () => ({ hasPremium: false }),
        checkServerPremium: async () => ({ hasPremium: false })
      };
    }
  }
  
  if (callRoxyAI === null) {
    try {
      const roxyAI = require('../../handlers/IA/RoxyAI');
      callRoxyAI = roxyAI.callRoxyAI;
      console.log('[ROXY] RoxyAI module loaded successfully');
    } catch (e) {
      console.error('[ROXY] Error loading RoxyAI:', e.message);
      console.error(e.stack);
      callRoxyAI = false;
    }
  }
}

async function handleMention(message, client) {
  console.log(`[ROXY IA] Mention received from ${message.author.tag}`);
  await loadDependencies();
  
  if (!callRoxyAI) {
    console.error('[ROXY IA] callRoxyAI is not available');
    await message.reply("AI system unavailable. Use `!help` for commands.");
    return;
  }

  // Verificar premium (usuario O servidor)
  let hasPremium = false;
  try {
    // Usar checkPremiumAccess que verifica usuario Y servidor
    const premiumResult = await premiumUtils.checkPremiumAccess(message.author.id, message.guild?.id);
    hasPremium = premiumResult.hasPremium;
    console.log(`[ROXY IA] Premium check: ${hasPremium ? 'YES' : 'NO'} (source: ${premiumResult.source || 'none'})`);
  } catch (e) {
    console.error('[ROXY IA] Error checking premium:', e.message);
  }

  let canUseIA = false;

  if (hasPremium) {
    canUseIA = true;
  } else if (!REQUIRE_PREMIUM) {
    const rateCheck = checkRateLimit(message.author.id);
    if (rateCheck.allowed) {
      canUseIA = true;
    } else {
      await message.reply(`❌ Limit reached: **${MESSAGES_PER_HOUR}/hour**. Wait **${rateCheck.minutesLeft}min** or get **Premium**!`);
      return;
    }
  } else {
    await message.reply("✨ AI chat requires **Premium**. Use `!help` for commands!");
    return;
  }

  const contentWithoutMention = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
    .trim();

  if (!contentWithoutMention) {
    const emptyResponses = [
      "*Bosteza* ¿Me invocas para nada? Atrevido. Usa `!help` si realmente necesitas algo.",
      "*Yawns* You summoned me for nothing? Bold. Use `!help` if you actually need something.",
      "¿Hola? ¿Alguien ahí? Usa `!help` si no sabes qué decir.",
      "Did you just... ping me with no message? How rude. Try `!help`."
    ];
    await message.reply(emptyResponses[Math.floor(Math.random() * emptyResponses.length)]);
    return;
  }

  await message.channel.sendTyping();
  const typingInterval = setInterval(() => {
    message.channel.sendTyping().catch(() => {});
  }, 5000);

  try {
    console.log(`[ROXY IA] Calling RoxyAI with message: "${contentWithoutMention.substring(0, 50)}..."`);
    const result = await callRoxyAI(contentWithoutMention, {
      userId: message.author.id,
      username: message.author.username,
      channelName: message.channel.name,
      guildName: message.guild.name,
      spainDate: new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" }),
      botInfo: {
        username: client.user.username,
        id: client.user.id,
        avatarURL: client.user.displayAvatarURL?.({ dynamic: true }),
        guildCount: client.guilds?.cache?.size,
        createdAt: client.user.createdAt?.toLocaleDateString("es-ES")
      }
    });

    clearInterval(typingInterval);
    console.log(`[ROXY IA] Result: ok=${result.ok}, hasContent=${!!result.content}, error=${result.error || 'none'}`);

    if (result.ok && result.content) {
      let response = result.content;
      if (response.length > 2000) response = response.substring(0, 1997) + "...";
      await message.reply(response);
    } else {
      console.error(`[ROXY IA] API failed: ${result.error}`);
      // Respuestas de error con personalidad, en ambos idiomas
      const errorResponses = [
        "*Suspira* Algo falló. Incluso yo tengo días malos. Usa `!help` para comandos.",
        "*Yawns* Technical difficulties. How boring. Try `!help` instead.",
        "Hmm, parece que algo no funciona. Qué molesto. Prueba con `!help`.",
        "*Rolls eyes* Something's broken. Not my fault, obviously. Use `!help`."
      ];
      await message.reply(errorResponses[Math.floor(Math.random() * errorResponses.length)]);
    }
  } catch (error) {
    clearInterval(typingInterval);
    console.error('[ROXY IA] Error:', error);
    await message.reply("*Suspira* Error técnico. Qué aburrido. Usa `!help` para comandos.");
  }
}

module.exports = {
    name: 'messageCreate',
    once: false,

    /**
     * Handle prefix commands and mentions from messages
     * @param {Message} message - Discord message
     * @param {Client} client - Discord client
     */
    async execute(message, client) {
        // Ignore bots and DMs
        if (message.author.bot) return;
        if (!message.guild) return;

        // Check for bot mention (IA handler)
        if (message.mentions.users.has(client.user.id) && !message.reference) {
            // Check it's not a prefix command that happens to mention the bot
            const contentLower = message.content.toLowerCase();
            const isPrefix = PREFIXES.some(p => contentLower.startsWith(p.toLowerCase()));
            if (!isPrefix) {
                return handleMention(message, client);
            }
        }

        // Check if message starts with any prefix (case insensitive)
        const contentLower = message.content.toLowerCase();
        const prefix = PREFIXES.find(p => contentLower.startsWith(p.toLowerCase()));
        if (!prefix) return;

        // Parse command and arguments
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Find command by name or alias
        const command = client.commands.get(commandName) || 
                        client.commands.get(client.aliases.get(commandName));

        if (!command) return;

        // Check if command supports prefix
        if (command.slashOnly) {
            const embed = EmbedFactory.warning(
                'Slash Command Only',
                `This command only works as a slash command. Use \`/${command.data.name}\` instead.`
            );
            return message.reply({ embeds: [embed] });
        }

        try {
            Logger.command(commandName, message.author.id, message.guildId);
            
            // Create a pseudo-interaction object for prefix commands
            const pseudoInteraction = createPseudoInteraction(message, args, command);
            
            await command.execute(pseudoInteraction, client);
        } catch (error) {
            Logger.error(`Error executing prefix command ${commandName}:`, error);

            const errorEmbed = EmbedFactory.error(
                'Command Error',
                'An error occurred while executing this command. Please try again later.'
            );

            await message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    },
};

/**
 * Create a pseudo-interaction object from a message for command compatibility
 * @param {Message} message - Discord message
 * @param {Array} args - Command arguments
 * @param {Object} command - Command object
 * @returns {Object} Pseudo-interaction object
 */
function createPseudoInteraction(message, args, command) {
    return {
        // Common properties
        id: message.id,
        user: message.author,
        member: message.member,
        guild: message.guild,
        guildId: message.guildId,
        channel: message.channel,
        channelId: message.channelId,
        createdAt: message.createdAt,
        
        // Prefix command flag
        isPrefix: true,
        message: message,
        args: args,
        
        // Simulated option getter
        options: {
            getString: (name) => {
                const option = command.data.options?.find(o => o.name === name);
                if (!option) return null;
                const index = command.data.options.indexOf(option);
                return args.slice(index).join(' ') || null;
            },
            getInteger: (name) => {
                const option = command.data.options?.find(o => o.name === name);
                if (!option) return null;
                const index = command.data.options.indexOf(option);
                const value = parseInt(args[index]);
                return isNaN(value) ? null : value;
            },
            getNumber: (name) => {
                const option = command.data.options?.find(o => o.name === name);
                if (!option) return null;
                const index = command.data.options.indexOf(option);
                const value = parseFloat(args[index]);
                return isNaN(value) ? null : value;
            },
            getBoolean: (name) => {
                const option = command.data.options?.find(o => o.name === name);
                if (!option) return null;
                const index = command.data.options.indexOf(option);
                const value = args[index]?.toLowerCase();
                return value === 'true' || value === 'yes' || value === '1';
            },
            getUser: (name) => {
                return message.mentions.users.first() || null;
            },
            getMember: (name) => {
                return message.mentions.members?.first() || null;
            },
            getChannel: (name) => {
                return message.mentions.channels.first() || null;
            },
            getRole: (name) => {
                return message.mentions.roles.first() || null;
            },
        },
        
        // Response methods
        replied: false,
        deferred: false,
        
        reply: async (options) => {
            const sent = await message.reply(options);
            return sent;
        },
        
        deferReply: async (options = {}) => {
            // For prefix commands, we'll just send a "thinking" message
            if (!options.silent) {
                await message.channel.sendTyping();
            }
        },
        
        editReply: async (options) => {
            // For prefix, reply to the original message
            return message.reply(options);
        },
        
        followUp: async (options) => {
            return message.channel.send(options);
        },
        
        deleteReply: async () => {
            // Not fully supported for prefix commands
            return;
        },
        
        // Check methods
        isChatInputCommand: () => false,
        isButton: () => false,
        isSelectMenu: () => false,
        isModalSubmit: () => false,
    };
}

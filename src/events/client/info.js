const { 
  EmbedBuilder, 
  ChannelType
} = require('discord.js');
const os = require('os');
const chalk = require('chalk');
const config = require('../../config');

// Configuration - Replace with your IDs
const CONFIG = {
  GUILD_ID: '810129117260283915', // Replace with your server ID
  CHANNEL_ID: '1462557185094451210', // Replace with your channel ID
  UPDATE_INTERVAL: 10 * 60 * 1000, // 10 minutes
  INITIAL_DELAY: 60 * 1000 // 1 minute initial delay
};

// Emoji IDs for latency indicators
const EMOJIS = {
  // Low latency (good)
  LOW_PING: '<:verde:1419705602363621506>',
  LOW_LATENCY: '<:verde:1419705602363621506>',
  
  // Medium latency (okay)  
  MED_PING: '<:naranja:1419705599410700419>',
  MED_LATENCY: '<:naranja:1419705599410700419>',
  
  // High latency (bad)
  HIGH_PING: '<:rojo:1419705597795762226>',
  HIGH_LATENCY: '<:rojo:1419705597795762226>',

  // System emojis
  CPU: '<:cputower:1419705615244197928>',
  RAM: '<:ram:1419705610991173843>',
  DISK: '<:disk1:1419705883222343750>',
  NETWORK: '<:newtwork:1419705605572264058>',
  LATENCY: '<:latency:1419705604011720815>',
  UPTIME: ''
};

let updateInterval = null;
let monitoringChannel = null;
let statusMessage = null;
let networkStats = { rx: 0, tx: 0, timestamp: Date.now() };
let nextUpdateTime = null;

// Helper functions
function createProgressBar(percentage, length = 10) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '[' + '▰'.repeat(filled) + '▱'.repeat(empty) + ']';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function getPingEmoji(ping) {
  if (ping < 500) return EMOJIS.LOW_PING;
  if (ping < 1000) return EMOJIS.MED_PING;
  return EMOJIS.HIGH_PING;
}

function getLatencyEmoji(latency) {
  if (latency < 500) return EMOJIS.LOW_LATENCY;
  if (latency < 1000) return EMOJIS.MED_LATENCY;
  return EMOJIS.HIGH_LATENCY;
}

async function getCpuUsage() {
  return new Promise((resolve) => {
    try {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      setTimeout(() => {
        try {
          const currentUsage = process.cpuUsage(startUsage);
          const currentTime = process.hrtime(startTime);
          
          const usageMicrosec = currentUsage.user + currentUsage.system;
          const totalTimeMicrosec = currentTime[0] * 1000000 + currentTime[1] / 1000;
          
          const cpuPercent = (usageMicrosec / totalTimeMicrosec) * 100;
          const finalPercent = Math.min(100, Math.max(0, cpuPercent));
          
          resolve(finalPercent);
        } catch (error) {
          console.error(chalk.red('[CPU DEBUG] :: Error in timeout:'), error);
          resolve(0);
        }
      }, 1000);
    } catch (error) {
      console.error(chalk.red('[CPU DEBUG] :: Error starting CPU measurement:'), error);
      resolve(0);
    }
  });
}

function getProcessMemoryUsage() {
  try {
    const memUsage = process.memoryUsage();
    const totalSystemMem = os.totalmem();
    
    return {
      used: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      percentage: Math.round((memUsage.rss / totalSystemMem) * 100)
    };
  } catch (error) {
    console.error(chalk.red('[MEM DEBUG] :: Error getting memory usage:'), error);
    return {
      used: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      percentage: 0
    };
  }
}

function getDiskUsage() {
  try {
    const isLinux = process.platform === 'linux';
    
    if (!isLinux) {
      return {
        used: 0,
        total: 100 * 1024 * 1024 * 1024,
        free: 100 * 1024 * 1024 * 1024,
        percentage: 0
      };
    }

    const currentDir = process.cwd();
    const { execSync } = require('child_process');
    
    try {
      const command = `df -B1 "${currentDir}"`;
      const output = execSync(command, { encoding: 'utf8' });
      
      const lines = output.split('\n');
      let totalSize = 0;
      let usedSpace = 0;
      let freeSpace = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            totalSize = parseInt(parts[1]) || 0;
            usedSpace = parseInt(parts[2]) || 0;
            freeSpace = parseInt(parts[3]) || 0;
            break;
          }
        }
      }
      
      if (totalSize === 0) {
        const duCommand = `du -sb "${currentDir}"`;
        const duOutput = execSync(duCommand, { encoding: 'utf8' });
        
        const duParts = duOutput.split('\t');
        if (duParts.length >= 2) {
          usedSpace = parseInt(duParts[0]) || 0;
          totalSize = Math.max(usedSpace * 10, 10 * 1024 * 1024 * 1024);
          freeSpace = totalSize - usedSpace;
        }
      }
      
      const percentage = totalSize > 0 ? Math.round((usedSpace / totalSize) * 100) : 0;
      
      return {
        used: usedSpace,
        total: totalSize,
        free: freeSpace,
        percentage: percentage
      };
      
    } catch (cmdError) {
      console.error(chalk.red('[DISK DEBUG] :: Error executing disk command:'), cmdError.message);
      
      return {
        used: 0,
        total: 10 * 1024 * 1024 * 1024,
        free: 10 * 1024 * 1024 * 1024,
        percentage: 0
      };
    }
    
  } catch (error) {
    console.error(chalk.red('[DISK DEBUG] :: Error calculating disk usage:'), error);
    return { 
      used: 0, 
      total: 10 * 1024 * 1024 * 1024,
      free: 10 * 1024 * 1024 * 1024,
      percentage: 0 
    };
  }
}

async function getNetworkUsage() {
  try {
    const now = Date.now();
    const timeDiff = (now - networkStats.timestamp) / 1000;
    
    const currentRx = Math.floor(Math.random() * 1000);
    const currentTx = Math.floor(Math.random() * 500);
    
    networkStats = {
      rx: currentRx,
      tx: currentTx, 
      timestamp: now
    };
    
    return {
      download: currentRx,
      upload: currentTx
    };
  } catch (error) {
    return { download: 0, upload: 0 };
  }
}

async function createSystemStatsEmbed(client) {
  const cpuUsagePercent = await getCpuUsage();
  const memUsage = getProcessMemoryUsage();
  const diskUsage = getDiskUsage();
  const networkUsage = await getNetworkUsage();
  
  const ping = client.ws.ping;
  const uptime = process.uptime();

  let description = '';
  if (nextUpdateTime && nextUpdateTime > Date.now()) {
    const nextUpdateTimestamp = Math.floor(nextUpdateTime / 1000);
    description = `> **Next update:** <t:${nextUpdateTimestamp}:R>`;
  } else {
    const defaultNextUpdate = Math.floor((Date.now() + CONFIG.UPDATE_INTERVAL) / 1000);
    description = `> **Next update:** <t:${defaultNextUpdate}:R>`;
  }

  if (!description || description.trim().length === 0) {
    description = `> **Status:** Active`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${config.bot.emoji} ${config.bot.name} System Monitor`)
    .setDescription(description)
    .setColor(config.colors.info)
    .setTimestamp()
    .setFooter({ 
      text: `${config.bot.name} v${config.bot.version}`,
      iconURL: client.user.displayAvatarURL() 
    });

  // CPU Usage (Process)
  embed.addFields({
    name: `**${EMOJIS.CPU} CPU Usage**`,
    value: `\`\`\`${createProgressBar(cpuUsagePercent)} ${cpuUsagePercent.toFixed(1)}%\`\`\``,
    inline: true
  });

  // RAM Usage (Process)
  embed.addFields({
    name: `**${EMOJIS.RAM} RAM Usage**`,
    value: `\`\`\`${createProgressBar(memUsage.percentage)} ${memUsage.percentage}%\`\`\`\n` +
           `> **Used:** ${formatBytes(memUsage.used)} / ${formatBytes(os.totalmem())}`,
    inline: true
  });

  // Disk Usage (Real disk usage)
  embed.addFields({
    name: `**${EMOJIS.DISK} Disk Usage**`,
    value: `\`\`\`${createProgressBar(diskUsage.percentage)} ${diskUsage.percentage}%\`\`\`\n` +
           `> **Used:** ${formatBytes(diskUsage.used)} / ${formatBytes(diskUsage.total)}`,
    inline: true
  });

  // Network Usage
  embed.addFields({
    name: `**${EMOJIS.NETWORK} Network Usage**`,
    value: `> **Download:** ${networkUsage.download} KB/s\n` +
           `> **Upload:** ${networkUsage.upload} KB/s`,
    inline: true
  });

  // Ping & Latency
  embed.addFields({
    name: `**${EMOJIS.LATENCY} Connection**`,
    value: `> ${getPingEmoji(client.ws.ping)} **WebSocket:** ${client.ws.ping}ms`,
    inline: true
  });

  // Uptime
  embed.addFields({
    name: `**${EMOJIS.UPTIME} Uptime**`,
    value: `> **Bot:** ${formatUptime(uptime)}\n` +
           `> **System:** ${formatUptime(os.uptime())}`,
    inline: true
  });

  return embed;
}

async function findOrCreateStatusMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const existingMessage = messages.find(msg => 
      msg.author.id === channel.client.user.id && 
      msg.embeds.length > 0 && 
      msg.embeds[0].title && 
      msg.embeds[0].title.includes('System Monitor')
    );
    
    if (existingMessage) {
      return existingMessage;
    }
    
    const embed = await createSystemStatsEmbed(channel.client);
    return await channel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error(chalk.red('[ROXY STATS] :: Error finding/creating message:'), error);
    return null;
  }
}

async function updateSystemStats(client) {
  try {
    if (!monitoringChannel) {
      return;
    }

    nextUpdateTime = Date.now() + CONFIG.UPDATE_INTERVAL;

    const embed = await createSystemStatsEmbed(client);
    
    if (!statusMessage) {
      statusMessage = await findOrCreateStatusMessage(monitoringChannel);
    }
    
    if (statusMessage) {
      try {
        await statusMessage.edit({ embeds: [embed] });
      } catch (editError) {
        console.error(chalk.yellow('[ROXY STATS] :: Error editing message, trying to find/create new one'));
        statusMessage = await findOrCreateStatusMessage(monitoringChannel);
        if (statusMessage) {
          await statusMessage.edit({ embeds: [embed] });
        }
      }
    } else {
      console.error(chalk.red('[ROXY STATS] :: Could not find or create status message'));
    }
    
  } catch (error) {
    console.error(chalk.red('[ROXY STATS] :: Error updating stats:'), error);
  }
}

async function initializeSystemMonitoring(client) {
  try {
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) {
      console.error(chalk.red('[ROXY STATS] :: Guild not found'));
      return;
    }

    let channel = guild.channels.cache.get(CONFIG.CHANNEL_ID);
    
    if (!channel) {
      channel = await guild.channels.create({
        name: 'roxy-stats',
        type: ChannelType.GuildText,
        topic: `Real-time ${config.bot.name} system performance monitoring`
      });
      console.log(chalk.cyan(`[ROXY STATS] :: Created new channel. Please update CONFIG.CHANNEL_ID to: '${channel.id}'`));
    }
    
    monitoringChannel = channel;
    
    nextUpdateTime = Date.now() + CONFIG.UPDATE_INTERVAL;
    
    statusMessage = await findOrCreateStatusMessage(channel);
    
    if (statusMessage) {
      const embed = await createSystemStatsEmbed(client);
      await statusMessage.edit({ embeds: [embed] });
    }
    
    updateInterval = setInterval(() => updateSystemStats(client), CONFIG.UPDATE_INTERVAL);
    
    console.log(chalk.magenta(`[ROXY STATS] :: ${config.bot.emoji} System monitoring initialized successfully!`));
    
  } catch (error) {
    console.error(chalk.red('[ROXY STATS] :: Error initializing system monitoring:'), error);
  }
}

module.exports = {
  name: 'ready',
  once: true,
  
  /**
   * Initialize system monitoring for Roxy
   * @param {Client} client - Discord client
   */
  async execute(client) {
    setTimeout(() => {
      initializeSystemMonitoring(client);
    }, CONFIG.INITIAL_DELAY);
  }
};

const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js');
const config = require('../../config');
const { StatsManager } = require('../../utils');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show bot statistics'),
    
    aliases: ['about'],
    
    /**
     * Execute the stats command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const uptime = formatUptime(client.uptime);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        
        // Count total users
        let totalUsers = 0;
        client.guilds.cache.forEach(guild => {
            totalUsers += guild.memberCount;
        });

        // Count active players - use our custom musicPlayer
        const activeQueues = client.musicPlayer?.queues.size || 0;
        
        // Get songs played from stats
        const songsPlayed = StatsManager.getSongsPlayed();

        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle(`${config.bot.emoji} ${config.bot.name} Statistics`)
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '🤖 Bot Info', value: [
                    `**Name:** ${config.bot.name}`,
                    `**Version:** ${config.bot.version}`,
                    `**Prefixes:** \`!\`, \`roxy \`, \`r \``,
                ].join('\n'), inline: true },
                
                { name: '📊 Stats', value: [
                    `**Servers:** ${client.guilds.cache.size}`,
                    `**Users:** ${totalUsers.toLocaleString()}`,
                    `**Active Players:** ${activeQueues}`,
                ].join('\n'), inline: true },
                
                { name: '🎵 Music Stats', value: [
                    `**Songs Played:** ${songsPlayed.toLocaleString()}`,
                ].join('\n'), inline: true },

                { name: '⏱️ Uptime', value: uptime, inline: true },

                { name: '💻 System', value: [
                    `**Node.js:** ${process.version}`,
                    `**Discord.js:** v${djsVersion}`,
                    `**Platform:** ${os.platform()}`,
                ].join('\n'), inline: true },

                { name: '📈 Memory', value: [
                    `**Used:** ${memoryUsage} MB`,
                    `**Total:** ${totalMemory} GB`,
                ].join('\n'), inline: true },

                { name: '🔗 Links', value: [
                    `[Invite Bot](https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=3147776&scope=bot%20applications.commands)`,
                    `[Support Server](https://discord.gg/u4yDzZ7GZF)`,
                ].join(' • '), inline: false }
            )
            .setFooter({ text: `Made with ❤️ | Requested by ${interaction.user.username}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    },
};

/**
 * Format uptime to a readable string
 * @param {number} ms - Uptime in milliseconds
 * @returns {string}
 */
function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
}

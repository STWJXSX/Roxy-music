const { ActivityType } = require('discord.js');
const { Logger, StatsManager } = require('../../utils');
const config = require('../../config');

module.exports = {
    name: 'ready',
    once: true,
    
    /**
     * Executed when the bot is ready
     * @param {Client} client - Discord client
     */
    async execute(client) {
        Logger.success(`${config.bot.emoji} ${config.bot.name} is online!`);
        Logger.info(`Logged in as ${client.user.tag}`);
        Logger.info(`Serving ${client.guilds.cache.size} guilds`);
        Logger.info(`Loaded ${client.commands.size} commands`);

        // Get initial songs count
        const songsPlayed = StatsManager.getSongsPlayed();

        // Set bot presence
        client.user.setPresence({
            activities: [
                {
                    name: `🎵 ${songsPlayed.toLocaleString()} songs played!`,
                    type: ActivityType.Custom,
                },
            ],
            status: 'online',
        });

        // Update presence periodically
        let activityIndex = 0;
        setInterval(() => {
            const currentSongs = StatsManager.getSongsPlayed();
            const activities = [
                { name: `🎵 ${currentSongs.toLocaleString()} songs played!`, type: ActivityType.Custom },
                { name: `!help | roxy help | r help`, type: ActivityType.Listening },
                { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
                { name: 'your favorite tunes 🎶', type: ActivityType.Listening },
            ];

            const activity = activities[activityIndex % activities.length];
            client.user.setActivity(activity.name, { type: activity.type });
            activityIndex++;
        }, 15000);
    },
};

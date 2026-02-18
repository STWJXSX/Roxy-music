const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song'),
    
    aliases: ['np', 'current', 'playing'],
    
    /**
     * Execute the nowplaying command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const queue = client.musicPlayer.getQueue(interaction.guildId);
        
        if (!queue || !queue.currentTrack) {
            const embed = EmbedFactory.error('No Music', 'There is nothing playing right now!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const track = queue.currentTrack;
        const progress = client.musicPlayer.getProgress(interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('Now Playing')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
                { name: 'Artist', value: track.author || 'Unknown', inline: true },
                { name: 'Duration', value: track.durationFormatted || 'Live', inline: true },
                { name: 'Volume', value: `${Math.round(queue.volume * 100)}%`, inline: true }
            )
            .setTimestamp();

        if (progress) {
            const currentTime = formatTime(progress.current);
            const totalTime = formatTime(progress.total);
            embed.addFields({
                name: 'Progress',
                value: `\`${currentTime}\` ${progress.progress} \`${totalTime}\``,
                inline: false
            });
        }

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        // Add loop mode info
        const loopModes = ['Off', 'Track', 'Queue'];
        const loopMode = loopModes[queue.loop] || 'Off';
        embed.addFields({
            name: 'Loop Mode',
            value: loopMode,
            inline: true
        });

        // Add queue info
        embed.addFields({
            name: 'Queue',
            value: `${queue.tracks.length} tracks`,
            inline: true
        });

        if (track.requestedBy) {
            embed.setFooter({
                text: `Requested by ${track.requestedBy.username}`,
                iconURL: track.requestedBy.displayAvatarURL()
            });
        }

        return interaction.reply({ embeds: [embed] });
    },
};

/**
 * Format milliseconds to MM:SS or HH:MM:SS
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

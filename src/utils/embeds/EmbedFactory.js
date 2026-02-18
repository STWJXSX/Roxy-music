const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

/**
 * Parse duration string to seconds
 * @param {string} duration - Duration string (e.g., "3:45", "1:23:45")
 * @returns {number} Duration in seconds
 */
function parseDurationToSeconds(duration) {
    if (!duration || typeof duration !== 'string') return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

/**
 * Embed Builder Utility
 * Creates consistent embeds throughout the bot
 */
class EmbedFactory {
    /**
     * Create a success embed
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @returns {EmbedBuilder}
     */
    static success(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    /**
     * Create an error embed
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @returns {EmbedBuilder}
     */
    static error(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    /**
     * Create an info embed
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @returns {EmbedBuilder}
     */
    static info(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    /**
     * Create a warning embed
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @returns {EmbedBuilder}
     */
    static warning(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
    }

    /**
     * Create a music/now playing embed
     * @param {Object} track - Track object
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder}
     */
    static nowPlaying(track, options = {}) {
        const duration = track.durationFormatted || String(track.duration) || 'Live';
        const durationSec = parseDurationToSeconds(duration);
        const endsAt = Math.floor(Date.now() / 1000) + durationSec;
        const durationValue = duration !== 'Live' && durationSec > 0 
            ? `${duration} (ends <t:${endsAt}:R>)` 
            : duration;
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('Now Playing')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
                { name: 'Duration', value: durationValue, inline: true }
            )
            .setTimestamp();

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        if (options.requestedBy) {
            embed.setFooter({ text: `Requested by ${options.requestedBy.username}`, iconURL: options.requestedBy.displayAvatarURL() });
        }

        return embed;
    }

    /**
     * Create a queue embed
     * @param {Array} tracks - Array of tracks
     * @param {Object} currentTrack - Currently playing track
     * @param {number} page - Current page
     * @param {number} totalPages - Total pages
     * @returns {EmbedBuilder}
     */
    static queue(tracks, currentTrack, page = 1, totalPages = 1) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('Music Queue')
            .setTimestamp();

        if (currentTrack) {
            embed.addFields({
                name: 'Now Playing',
                value: `**[${currentTrack.title}](${currentTrack.url})** - \`${currentTrack.duration}\``,
                inline: false
            });
        }

        if (tracks.length > 0) {
            const queueList = tracks
                .map((track, index) => `**${(page - 1) * 10 + index + 1}.** [${track.title}](${track.url}) - \`${track.duration}\``)
                .join('\n');

            embed.addFields({
                name: 'Up Next',
                value: queueList || 'No tracks in queue',
                inline: false
            });
        } else {
            embed.setDescription('The queue is empty! Add some tracks with `/play`');
        }

        if (totalPages > 1) {
            embed.setFooter({ text: `Page ${page}/${totalPages}` });
        }

        return embed;
    }

    /**
     * Create a track added embed
     * @param {Object} track - Track object
     * @param {number} position - Position in queue
     * @param {Object} requestedBy - User who requested
     * @returns {EmbedBuilder}
     */
    static trackAdded(track, position, requestedBy) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('Added to Queue')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
                { name: 'Duration', value: track.durationFormatted || String(track.duration) || 'Live', inline: true },
                { name: 'Position', value: `#${position}`, inline: true }
            )
            .setTimestamp();

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        if (requestedBy) {
            embed.setFooter({ text: `Requested by ${requestedBy.username}`, iconURL: requestedBy.displayAvatarURL() });
        }

        return embed;
    }

    /**
     * Create a playlist added embed
     * @param {Object} playlist - Playlist object
     * @param {number} trackCount - Number of tracks added
     * @param {Object} requestedBy - User who requested
     * @returns {EmbedBuilder}
     */
    static playlistAdded(playlist, trackCount, requestedBy) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('Playlist Added to Queue')
            .setDescription(`**[${playlist.title}](${playlist.url})**`)
            .addFields(
                { name: 'Tracks', value: `${trackCount} tracks`, inline: true },
                { name: 'Author', value: playlist.author?.name || 'Unknown', inline: true }
            )
            .setTimestamp();

        if (playlist.thumbnail?.url) {
            embed.setThumbnail(playlist.thumbnail.url);
        }

        if (requestedBy) {
            embed.setFooter({ text: `Requested by ${requestedBy.username}`, iconURL: requestedBy.displayAvatarURL() });
        }

        return embed;
    }

    /**
     * Create a goodbye embed when bot leaves
     * @param {Client} client - Discord client
     * @returns {EmbedBuilder}
     */
    static goodbye(client) {
        const embed = new EmbedBuilder()
            .setColor('#FF6B9D')
            .setTitle('👋 See you later!')
            .setDescription([
                '**Music stopped and queue cleared.**',
                '',
                'Thanks for using **Roxy**! 🎵',
                '',
                '> *If you enjoyed the music, consider checking out our links below!*'
            ].join('\n'))
            .setThumbnail(client?.user?.displayAvatarURL({ size: 128 }) || null)
            .setFooter({ text: 'Roxy Music Bot • Powered by love ❤️' })
            .setTimestamp();

        return embed;
    }
}

module.exports = EmbedFactory;

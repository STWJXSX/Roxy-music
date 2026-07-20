const { EmbedFactory, Logger } = require('../utils');
const config = require('../config');

/**
 * Register player events
 * @param {Client} client - Discord client instance
 */
function registerPlayerEvents(client) {
    // Track started playing - emitted by our MusicPlayer
    client.on('trackStart', (queue, track) => {
        Logger.music(`Now playing: ${track.title} in ${queue.voiceChannel.guild.name}`);
        
        const embed = EmbedFactory.nowPlaying(track, {
            requestedBy: track.requestedBy,
        });

        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    // Track failed to play
    client.on('trackError', (queue, track, error) => {
        const isUnavailable =
            error.message.includes('not available') ||
            error.message.includes('unavailable') ||
            error.message.includes('Private video') ||
            error.message.includes('has been removed') ||
            error.message.includes('Requested format is not available');

        const description = isUnavailable
            ? `The video is unavailable, private, or restricted in this region.`
            : `An error occurred while trying to play it. Skipping to the next track.`;

        const embed = EmbedFactory.error(`❌ Can't play: ${track.title}`, description);
        queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    });

    Logger.success('Player events registered');
}

module.exports = { registerPlayerEvents };

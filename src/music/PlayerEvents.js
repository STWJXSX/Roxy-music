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

    Logger.success('Player events registered');
}

module.exports = { registerPlayerEvents };

require('dotenv').config();

module.exports = {
    // Discord Configuration
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    prefix: ["!", "r", "roxy", "R", "ROXY"],

    // Embed Colors
    colors: {
        success: process.env.COLOR_SUCCESS || '#00FF00',
        error: process.env.COLOR_ERROR || '#FF0000',
        info: process.env.COLOR_INFO || '#5865F2',
        warning: process.env.COLOR_WARNING || '#FFA500',
    },

    // Spotify Configuration
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    },

    // Player Settings
    player: {
        defaultVolume: parseInt(process.env.DEFAULT_VOLUME) || 50,
        maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE) || 500,
        leaveOnEmpty: process.env.LEAVE_ON_EMPTY === 'true',
        leaveOnEmptyCooldown: parseInt(process.env.LEAVE_ON_EMPTY_COOLDOWN) || 60000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 60000,
        ytdlOptions: {
            quality: 'highestaudio',
            highWaterMark: 1 << 25,
        },
    },

    // Bot Info
    bot: {
        name: 'Roxy',
        version: '1.0.0',
        emoji: '🎵',
    },

    // System Configuration
    // Set IS_WINDOWS=true in .env for Windows (uses yt-dlp.exe)
    // Set IS_WINDOWS=false for Linux/Debian/Ubuntu (uses system yt-dlp from apt)
    isWindows: process.env.IS_WINDOWS !== 'false', // Default to Windows if not specified
};

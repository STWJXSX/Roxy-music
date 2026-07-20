require('dotenv').config();

const path = require('path');
const { existsSync } = require('fs');

const IS_PROD = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const TOKEN = IS_PROD ? process.env.TOKEN_PROD : process.env.TOKEN_TEST;
const isWindows = process.platform === 'win32';
const roxyRoot = path.join(__dirname, '..', '..');
const localYtDlp = path.join(roxyRoot, 'yt-dlp.exe');

module.exports = {
    // Discord Configuration
    token: TOKEN,
    isProd: IS_PROD,
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

    // Platform tools (auto-detected via process.platform)
    isWindows,
    ytDlpPath: isWindows ? (existsSync(localYtDlp) ? localYtDlp : 'yt-dlp') : 'yt-dlp',
    ffmpegBin: 'ffmpeg',
};

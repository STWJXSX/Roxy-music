/**
 * Format milliseconds to a human-readable duration string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (HH:MM:SS or MM:SS)
 */
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const paddedSeconds = seconds.toString().padStart(2, '0');
    const paddedMinutes = minutes.toString().padStart(2, '0');

    if (hours > 0) {
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    }
    return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., "3:45", "1:23:45")
 * @returns {number} Duration in milliseconds
 */
function parseDuration(duration) {
    if (!duration) return 0;
    
    const parts = duration.split(':').map(Number);
    
    if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    } else if (parts.length === 2) {
        return (parts[0] * 60 + parts[1]) * 1000;
    }
    return parts[0] * 1000;
}

/**
 * Create a progress bar
 * @param {number} current - Current position
 * @param {number} total - Total duration
 * @param {number} length - Bar length (default: 15)
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, length = 15) {
    if (!total) return '▬'.repeat(length);
    
    const progress = Math.round((current / total) * length);
    const emptyProgress = length - progress;
    
    const progressBar = '▰'.repeat(progress) + '▱'.repeat(emptyProgress);
    return progressBar;
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Check if a string is a valid URL
 * @param {string} string - String to check
 * @returns {boolean} Whether the string is a valid URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if URL is from YouTube
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
    if (!isValidUrl(url)) return false;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+$/;
    return youtubeRegex.test(url);
}

/**
 * Check if URL is from Spotify
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isSpotifyUrl(url) {
    if (!isValidUrl(url)) return false;
    const spotifyRegex = /^(https?:\/\/)?(open\.)?spotify\.com\/.+$/;
    return spotifyRegex.test(url);
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Shuffle an array
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

module.exports = {
    formatDuration,
    parseDuration,
    createProgressBar,
    truncate,
    isValidUrl,
    isYouTubeUrl,
    isSpotifyUrl,
    sleep,
    shuffleArray,
};

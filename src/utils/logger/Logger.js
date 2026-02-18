const chalk = require('chalk');

/**
 * Check if production mode is enabled
 */
const isProduction = () => process.env.PRODUCTION === 'true' || process.env.NODE_ENV === 'production';

/**
 * Logger Utility
 * Provides consistent logging throughout the bot
 * In PRODUCTION mode, all logging is disabled for maximum performance
 */
class Logger {
    static #formatTimestamp() {
        return new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    }

    static #formatMessage(level, message, ...args) {
        const timestamp = this.#formatTimestamp();
        const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
        ).join(' ') : '';
        
        return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
    }

    /**
     * Log info message
     */
    static info(message, ...args) {
        if (isProduction()) return;
        console.log(chalk.blue(this.#formatMessage('INFO', message, ...args)));
    }

    /**
     * Log success message
     */
    static success(message, ...args) {
        if (isProduction()) return;
        console.log(chalk.green(this.#formatMessage('SUCCESS', message, ...args)));
    }

    /**
     * Log warning message
     */
    static warn(message, ...args) {
        if (isProduction()) return;
        console.log(chalk.yellow(this.#formatMessage('WARN', message, ...args)));
    }

    /**
     * Log error message (ALWAYS logged even in production for critical issues)
     */
    static error(message, ...args) {
        console.log(chalk.red(this.#formatMessage('ERROR', message, ...args)));
    }

    /**
     * Log debug message
     */
    static debug(message, ...args) {
        if (isProduction()) return;
        if (process.env.DEBUG === 'false') return;
        console.log(chalk.magenta(this.#formatMessage('DEBUG', message, ...args)));
    }

    /**
     * Log queue state
     */
    static queueState(queue) {
        if (isProduction()) return;
        if (!queue) {
            console.log(chalk.gray(this.#formatMessage('QUEUE', 'No queue')));
            return;
        }
        const state = {
            guildId: queue.guildId,
            tracks: queue.tracks.length,
            currentTrack: queue.currentTrack?.title || 'None',
            playing: queue.playing,
            paused: queue.paused,
            loop: queue.loop,
            volume: Math.round(queue.volume * 100) + '%'
        };
        console.log(chalk.gray(this.#formatMessage('QUEUE', JSON.stringify(state))));
    }

    /**
     * Log music-related message
     */
    static music(message, ...args) {
        if (isProduction()) return;
        console.log(chalk.cyan(this.#formatMessage('MUSIC', message, ...args)));
    }

    /**
     * Log command execution
     */
    static command(commandName, userId, guildId) {
        if (isProduction()) return;
        console.log(chalk.hex('#FFA500')(this.#formatMessage('COMMAND', `${commandName} executed by ${userId} in ${guildId}`)));
    }
}

module.exports = Logger;

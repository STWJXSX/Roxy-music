require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env'), override: true });
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const chalk = require('chalk');
const { MusicPlayer, registerPlayerEvents } = require('./src/music');
const config = require('./src/config');

// Mode detection — same pattern as all other bots
const IS_PROD = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
console.log(`[ROXY] Mode: ${IS_PROD ? chalk.red('PRODUCTION') : chalk.green('DEV')} (${IS_PROD ? 'TOKEN_PROD' : 'TOKEN_TEST'})`);
if (!config.token) {
    console.error(chalk.red(`[ROXY] Missing token: ${IS_PROD ? 'TOKEN_PROD' : 'TOKEN_TEST'} not set in .env`));
    process.exit(1);
}

// Suppress verbose logs in production
const log = (...args) => { if (!IS_PROD) console.log(...args); };

/**
 * Roxy Music Bot
 * A modern Discord music bot with YouTube and Spotify support
 */
class RoxyBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent,
            ],
            partials: [
                Partials.Channel,
                Partials.Message,
            ],
        });

        this.musicPlayer = new MusicPlayer(this.client);
    }

    /**
     * Initialize and start the bot
     */
    async start() {
        try {
            log(chalk.cyan(`[ROXY] :: Starting ${config.bot.name} v${config.bot.version}...`));
            if (IS_PROD) console.log(chalk.green('[ROXY] :: Starting in PRODUCTION mode (logging disabled)'));

            // Validate configuration
            if (!config.clientId) {
                throw new Error('Missing CLIENT_ID in environment variables');
            }

            // Initialize music player
            await this.musicPlayer.initialize();
            
            // Register player events (pass client, not player)
            registerPlayerEvents(this.client);

            // Attach music player to client
            this.client.musicPlayer = this.musicPlayer;

            // Load events first
            const cargarEventos = require('./handlers/cargarEventos');
            await cargarEventos(this.client);

            // Setup error handlers
            this.setupErrorHandlers();

            // Login to Discord
            await this.client.login(config.token);

            // Load commands after login (needs application)
            const cargarComandos = require('./handlers/cargarComandos');
            await cargarComandos(this.client);

            log(chalk.green(`[ROXY] :: ${config.bot.name} is now online!`));
            if (IS_PROD) console.log(chalk.green('[ROXY] :: Bot is now online and ready!'));

        } catch (error) {
            console.error(chalk.red('[ROXY] :: Failed to start bot:'), error);
            process.exit(1);
        }
    }

    /**
     * Setup error handlers
     */
    setupErrorHandlers() {
        // Client error handler
        this.client.on('error', (error) => {
            console.error(chalk.red('[ROXY ERROR] :: Client error:'), error);
        });

        // Process error handlers
        process.on('unhandledRejection', (reason, promise) => {
            const errorMessage = reason?.message || String(reason);
            
            // Handle known voice connection errors gracefully
            if (errorMessage.includes('IP discovery') || errorMessage.includes('socket closed')) {
                console.warn(chalk.yellow('[ROXY WARN] :: Voice connection issue (will auto-retry):'), errorMessage);
                return; // Don't log as error, it's handled
            }
            
            console.error(chalk.red('[ROXY ERROR] :: Unhandled Rejection:'), reason);
        });

        process.on('uncaughtException', (error) => {
            const errorMessage = error?.message || String(error);
            
            // Handle known voice connection errors gracefully
            if (errorMessage.includes('IP discovery') || errorMessage.includes('socket closed')) {
                console.warn(chalk.yellow('[ROXY WARN] :: Voice connection issue:'), errorMessage);
                return;
            }
            
            console.error(chalk.red('[ROXY ERROR] :: Uncaught Exception:'), error);
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            log(chalk.yellow('[ROXY] :: Received SIGINT. Shutting down...'));
            this.shutdown();
        });

        process.on('SIGTERM', () => {
            log(chalk.yellow('[ROXY] :: Received SIGTERM. Shutting down...'));
            this.shutdown();
        });
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            log(chalk.yellow('[ROXY] :: Stopping music player...'));
            // Stop all queues using our custom music player
            if (this.client.musicPlayer) {
                this.client.musicPlayer.queues.forEach((queue, guildId) => {
                    if (queue.ffmpeg) {
                        try { queue.ffmpeg.kill('SIGKILL'); } catch (e) {}
                    }
                    if (queue.connection) {
                        queue.connection.destroy();
                    }
                });
                this.client.musicPlayer.queues.clear();
            }

            await this.client.destroy();
            console.log(chalk.green('[ROXY] :: Shutdown complete. Goodbye!'));
            process.exit(0);
        } catch (error) {
            console.error(chalk.red('[ROXY ERROR] :: Error during shutdown:'), error);
            process.exit(1);
        }
    }
}

// Create and start the bot
const bot = new RoxyBot();
bot.start();

module.exports = RoxyBot;

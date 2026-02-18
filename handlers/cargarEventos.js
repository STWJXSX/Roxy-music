const { readdirSync, statSync } = require('fs');
const path = require('path');
const chalk = require('chalk');

// Production mode check
const isProduction = process.env.PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
const log = (...args) => { if (!isProduction) console.log(...args); };

/**
 * Recursively get all .js files in a directory
 */
function getAllEventFiles(dir) {
    let results = [];
    const list = readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllEventFiles(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

module.exports = async (client) => {
    let counter = 0;
    const eventsPath = path.join(__dirname, '../src/events');
    const eventFiles = getAllEventFiles(eventsPath);

    for (const filePath of eventFiles) {
        try {
            // Clear cache for hot reloading
            delete require.cache[require.resolve(filePath)];
            
            const event = require(filePath);
            
            if (!event || !event.name || typeof event.execute !== 'function') continue;

            // Register event with Discord.js client
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            
            counter++;
        } catch (err) {
            console.warn(chalk.red(`[ROXY EVENTS] :: Could not load ${filePath}: ${err.message}`));
            continue;
        }
    }

    log(chalk.cyan(`[ROXY EVENTS] :: Loaded ${counter} events!`));
};

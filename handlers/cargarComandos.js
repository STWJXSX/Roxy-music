const { readdirSync, statSync } = require('fs');
const { Collection, Routes } = require('discord.js');
const path = require('path');
const chalk = require('chalk');

// Production mode check
const isProduction = process.env.PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
const log = (...args) => { if (!isProduction) console.log(...args); };

/**
 * Recursively get all .js files in a directory
 */
function getAllCommandFiles(dir) {
    let results = [];
    const list = readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllCommandFiles(filePath));
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

async function waitForApplication(client, timeout = 10000) {
    const start = Date.now();
    while (!client.application) {
        if (Date.now() - start > timeout) {
            throw new Error("Timeout waiting for client application to be available.");
        }
        await new Promise(res => setTimeout(res, 200));
    }
    return client.application;
}

module.exports = async (client) => {
    client.commands = new Collection();
    client.aliases = new Collection();
    let counter = 0;
    const commandsPath = path.join(__dirname, '../src/commands');
    const commandFiles = getAllCommandFiles(commandsPath);
    const slashCommands = [];

    for (const filePath of commandFiles) {
        try {
            // Clear cache for hot reloading
            delete require.cache[require.resolve(filePath)];
            
            const command = require(filePath);
            
            // Only load if it has data and execute
            if (!command || !command.data || !command.data.name || typeof command.execute !== 'function') continue;
            
            // Get category from folder name
            const relativePath = path.relative(commandsPath, filePath);
            const category = path.dirname(relativePath).split(path.sep)[0];
            command.category = category;
            
            client.commands.set(command.data.name, command);
            slashCommands.push(command.data.toJSON());
            
            // Register aliases
            if (command.aliases && Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    client.aliases.set(alias, command.data.name);
                }
            }
            
            counter++;
        } catch (err) {
            console.warn(chalk.red(`[ROXY COMMANDS] :: Could not load ${filePath}: ${err.message}`));
            continue;
        }
    }

    log(chalk.magenta(`[ROXY COMMANDS] :: Loaded ${counter} commands!`));

    try {
        await waitForApplication(client);
        await client.application.fetch();
    } catch (err) {
        console.error(chalk.red("[ROXY COMMANDS] :: Could not get client application:", err.message));
        return;
    }

    // Register global slash commands
    await client.rest.put(
        Routes.applicationCommands(client.application.id),
        {
            body: slashCommands.map(c => {
                c.integration_types = [0, 1];
                c.contexts = [0, 1, 2];
                return c;
            })
        }
    );

    log(chalk.magenta("[ROXY COMMANDS] :: Slash commands registered globally!"));
};

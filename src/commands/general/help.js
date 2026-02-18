const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands')
        .addStringOption(option =>
            option
                .setName('command')
                .setDescription('Get detailed help for a specific command')
                .setRequired(false)
        ),
    
    aliases: ['h', 'commands', 'cmds'],
    
    /**
     * Execute the help command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const commandName = interaction.options.getString('command');

        if (commandName) {
            // Show specific command help
            const command = client.commands.get(commandName.toLowerCase()) || 
                           client.commands.get(client.aliases.get(commandName.toLowerCase()));

            if (!command) {
                const embed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle('❌ Command Not Found')
                    .setDescription(`No command found with name \`${commandName}\``)
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle(`📖 Command: /${command.data.name}`)
                .setDescription(command.data.description)
                .addFields(
                    { name: '📂 Category', value: command.category || 'General', inline: true },
                    { name: '🏷️ Aliases', value: command.aliases?.length > 0 ? command.aliases.map(a => `\`!${a}\``).join(', ') : 'None', inline: true }
                )
                .setTimestamp();

            // Add options if any
            if (command.data.options?.length > 0) {
                const optionsList = command.data.options.map(opt => {
                    const required = opt.required ? '(required)' : '(optional)';
                    return `\`${opt.name}\` - ${opt.description} ${required}`;
                }).join('\n');
                embed.addFields({ name: '⚙️ Options', value: optionsList, inline: false });
            }

            // Usage examples
            embed.addFields({
                name: '💡 Usage',
                value: `Slash: \`/${command.data.name}\`\nPrefix: \`!${command.data.name}\`, \`roxy ${command.data.name}\`, \`r ${command.data.name}\``,
                inline: false
            });

            return interaction.reply({ embeds: [embed] });
        }

        // Show all commands
        const categories = new Map();
        
        client.commands.forEach(command => {
            const category = command.category || 'general';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(command);
        });

        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle(`${config.bot.emoji} ${config.bot.name} - Help Menu`)
            .setDescription(
                `Welcome to **${config.bot.name}**! Here are all available commands.\n\n` +
                `**Prefixes:** \`!\`, \`roxy \`, \`r \` (case insensitive)\n` +
                `**Examples:** \`!play\`, \`roxy play\`, \`r play\`, \`ROXY play\`\n` +
                `**Slash Commands:** All commands work as \`/command\` too!\n\n` +
                `Use \`/help <command>\` for detailed info on a specific command.`
            )
            .setTimestamp();

        // Add fields for each category
        const categoryEmojis = {
            music: '🎵',
            general: '⚙️',
            fun: '🎉',
            utility: '🔧',
        };

        categories.forEach((commands, category) => {
            const emoji = categoryEmojis[category] || '📁';
            const commandList = commands.map(cmd => `\`${cmd.data.name}\``).join(', ');
            embed.addFields({
                name: `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                value: commandList,
                inline: false
            });
        });

        embed.setFooter({ 
            text: `${config.bot.name} v${config.bot.version} • ${client.commands.size} commands` 
        });

        // Add support buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/u4yDzZ7GZF')
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setLabel('Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=3147776&scope=bot%20applications.commands`)
                    .setEmoji('➕')
            );

        return interaction.reply({ embeds: [embed], components: [row] });
    },
};

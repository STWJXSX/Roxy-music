const { Logger, EmbedFactory } = require('../../utils');

module.exports = {
    name: 'interactionCreate',
    once: false,

    /**
     * Handle slash command interactions
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            Logger.warn(`Unknown command: ${interaction.commandName}`);
            return;
        }

        try {
            Logger.command(interaction.commandName, interaction.user.id, interaction.guildId);
            await command.execute(interaction, client);
        } catch (error) {
            Logger.error(`Error executing command ${interaction.commandName}:`, error);

            const errorEmbed = EmbedFactory.error(
                'Command Error',
                'An error occurred while executing this command. Please try again later.'
            );

            const replyOptions = { embeds: [errorEmbed], ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyOptions).catch(() => {});
            } else {
                await interaction.reply(replyOptions).catch(() => {});
            }
        }
    },
};

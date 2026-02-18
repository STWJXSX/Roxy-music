const { Logger, EmbedFactory } = require('../../utils');
const config = require('../../config');
const { checkCommandPremiumRequirements, getPremiumErrorMessage } = require('../../utils/premiumUtils');

module.exports = {
    name: 'interactionCreate',
    once: false,

    /**
     * Handle slash command interactions
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        // Only handle chat input commands (slash commands)
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            Logger.warn(`Unknown command: ${interaction.commandName}`);
            return;
        }

        try {
            // ========================================
            // PREMIUM CHECK
            // ========================================
            // Available properties for commands:
            // 
            // BY ENTITY:
            //   UserPrem: true          → Any user premium
            //   ServPrem: true          → Server premium
            // 
            // BY PREMIUM TYPE:
            //   PremUniversal: true     → Universal premium only
            //   PremPackCompleto: true  → Complete Pack only
            //   PremYoutube: true       → YouTube promotion only
            // 
            // BY DURATION:
            //   PremAnual: true         → Annual premium only
            //   PremPermanente: true    → Permanent premium only
            //   PremMensual: true       → Monthly premium only
            // ========================================
            
            const premiumCheck = await checkCommandPremiumRequirements(
                command,
                interaction.user.id,
                interaction.guild?.id || null
            );
            
            if (!premiumCheck.allowed) {
                const errorMessage = getPremiumErrorMessage(premiumCheck.reason, 'en');
                const embedNo = EmbedFactory.warning('Premium Required', errorMessage);
                
                return await interaction.reply({
                    embeds: [embedNo],
                    ephemeral: true
                });
            }

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

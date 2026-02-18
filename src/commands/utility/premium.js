/**
 * COMANDO: Premium - Comandos de usuario para premium
 * Para Roxy Music Bot - Sistema Premium V2
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const PremiumV2 = require('../../modelosdb/premium/PremiumV2');
const PremiumKeysV2 = require('../../modelosdb/premium/PremiumKeysV2');

const COLORS = {
  success: "#00ae86",
  error: "#ff6b6b",
  warning: "#ffa500",
  premium: "#FFD700",
};

const PREMIUM_TYPE_NAMES = {
  "universal": "Universal (all bots)",
  "bot_catbot": "CatBot",
  "bot_catbotfn": "CatBotFN",
  "bot_roxy": "Roxy Music",
  "web": "Web AI",
  "pack_completo": "Complete Pack",
  "youtube": "YouTube Promotion",
  "servidor": "Server"
};

const DURATION_NAMES = {
  "mensual": "Monthly",
  "anual": "Annual",
  "personalizado": "Custom",
  "permanente": "Permanent",
  "youtube": "While video exists"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Premium system')
    .setDMPermission(true)
    .addSubcommand(subcommand =>
      subcommand
        .setName('redeem')
        .setDescription('Redeem a premium key')
        .addStringOption(option => 
          option.setName('key')
            .setDescription('Premium key to redeem')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Check your premium status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Information about premium plans')
    ),
    
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'redeem':
        return await handleRedeem(interaction);
      case 'check':
        return await handleCheck(interaction);
      case 'info':
        return await handleInfo(interaction);
      default:
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.error)
              .setDescription('❌ Unrecognized subcommand.')
          ],
          ephemeral: true
        });
    }
  }
};

async function handleRedeem(interaction) {
  await interaction.deferReply();
  
  const key = interaction.options.getString('key');
  
  try {
    // Find the key
    const keyData = await PremiumKeysV2.findOne({ key });
    
    if (!keyData) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.error)
            .setDescription(`❌ The premium key \`${key}\` does not exist.`)
        ]
      });
    }
    
    // Validate key
    const validation = keyData.isValid(interaction.user.id);
    if (!validation.valid) {
      let errorMsg = "";
      switch (validation.reason) {
        case "used":
          errorMsg = `❌ The premium key \`${key}\` has already been used.`;
          break;
        case "expired":
          errorMsg = `❌ The premium key \`${key}\` has expired.`;
          break;
        case "wrong_user":
          errorMsg = `❌ This premium key is intended for another user.`;
          break;
        default:
          errorMsg = `❌ Invalid key.`;
      }
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(errorMsg)]
      });
    }
    
    // Determine entity type
    const entityType = keyData.entityType;
    
    if (entityType === "servidor") {
      // Server key
      if (!interaction.guild) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.error)
              .setDescription(`❌ **Server**-type keys must be redeemed within a server.`)
          ]
        });
      }
      
      // Check admin permissions
      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.error)
              .setDescription(`❌ You need **administrator** permissions to redeem a server key.`)
          ]
        });
      }
      
      // Check if server already has premium
      const { hasPremium } = await PremiumV2.hasActiveServerPremium(interaction.guild.id);
      if (hasPremium) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.warning)
              .setDescription(`⭐ This server already has active premium.`)
          ]
        });
      }
      
      // Confirmation
      const confirmEmbed = new EmbedBuilder()
        .setColor(COLORS.premium)
        .setTitle(`⭐ Premium Confirmation`)
        .setDescription(`Are you sure you want to activate premium in **${interaction.guild.name}**?\n\n**Type:** ${PREMIUM_TYPE_NAMES[keyData.premiumType]}\n**Duration:** ${DURATION_NAMES[keyData.durationType]}${keyData.customDays ? ` (${keyData.customDays} days)` : ""}`)
        .setFooter({ text: "This confirmation will expire in 60 seconds" });
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("confirm_premium").setLabel("Yes, activate").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cancel_premium").setLabel("Cancel").setStyle(ButtonStyle.Danger)
      );
      
      const response = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
      
      try {
        const confirmation = await response.awaitMessageComponent({ 
          filter: i => i.user.id === interaction.user.id,
          time: 60000 
        });
        
        if (confirmation.customId === "cancel_premium") {
          return confirmation.update({
            embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription(`❌ Activation cancelled.`)],
            components: []
          });
        }
        
        // Activate server premium
        await activatePremium(keyData, interaction.guild.id, "servidor", interaction.user.id);
        
        return confirmation.update({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.success)
              .setTitle(`⭐ Premium Activated`)
              .setDescription(`✅ Premium activated in **${interaction.guild.name}**`)
              .addFields(
                { name: "Type", value: PREMIUM_TYPE_NAMES[keyData.premiumType], inline: true },
                { name: "Duration", value: DURATION_NAMES[keyData.durationType], inline: true }
              )
          ],
          components: []
        });
        
      } catch {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ Time expired.`)],
          components: []
        });
      }
      
    } else {
      // User key
      // Check if already has premium
      const { hasPremium, premiums } = await PremiumV2.hasActivePremium(interaction.user.id);
      
      if (hasPremium && premiums.length > 0) {
        const existingTypes = premiums.map(p => PREMIUM_TYPE_NAMES[p.premiumType] || p.premiumType).join(", ");
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.warning)
              .setDescription(`⭐ You already have active premium:\n**${existingTypes}**`)
          ]
        });
      }
      
      // Activate premium
      const premium = await activatePremium(keyData, interaction.user.id, "usuario", interaction.user.id);
      
      const expiresText = premium.expiresAt 
        ? `<t:${Math.floor(premium.expiresAt.getTime() / 1000)}:F>`
        : "Never";
      
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.success)
            .setTitle(`⭐ Premium Activated`)
            .setDescription(`✅ You have successfully redeemed the premium key.`)
            .addFields(
              { name: "Type", value: PREMIUM_TYPE_NAMES[keyData.premiumType] || keyData.premiumType, inline: true },
              { name: "Duration", value: DURATION_NAMES[keyData.durationType], inline: true },
              { name: "Expires", value: expiresText, inline: true }
            )
            .setAuthor({
              name: interaction.user.username,
              iconURL: interaction.user.displayAvatarURL()
            })
        ]
      });
    }
    
  } catch (error) {
    console.error("Error redeeming premium:", error);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.error)
          .setDescription(`❌ Error processing the key: ${error.message}`)
      ]
    });
  }
}

async function activatePremium(keyData, targetId, entityType, activatedBy) {
  // Calculate expiration
  const expiresAt = keyData.calculateExpirationDate();
  
  // Determine applicable bots
  let applicableBots = ["all"];
  if (keyData.premiumType === "bot_roxy") applicableBots = ["all"]; // Roxy specific
  
  // Create premium
  const premium = await PremiumV2.create({
    discordId: targetId,
    entityType,
    premiumType: keyData.premiumType,
    applicableBots,
    durationType: keyData.durationType,
    customDays: keyData.customDays,
    expiresAt,
    key: keyData.key,
    createdBy: keyData.createdBy,
    activatedBy,
    reason: keyData.reason,
    metadata: { source: "key" }
  });
  
  // Mark key as used
  keyData.uses = 0;
  keyData.isRedeemed = true;
  keyData.redeemedBy = activatedBy;
  keyData.redeemedAt = new Date();
  await keyData.save();
  
  return premium;
}

async function handleCheck(interaction) {
  await interaction.deferReply();
  
  try {
    // Check user premium
    const { hasPremium: hasUserPremium, premiums: userPremiums } = await PremiumV2.hasActivePremium(interaction.user.id);
    
    // Check server premium
    let serverPremium = null;
    if (interaction.guild) {
      const serverResult = await PremiumV2.hasActiveServerPremium(interaction.guild.id);
      if (serverResult.hasPremium) serverPremium = serverResult.premium;
    }
    
    if (!hasUserPremium && !serverPremium) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.premium)
            .setTitle(`⭐ Premium Status`)
            .setDescription(`❌ You don't have active premium on your account${interaction.guild ? ' or in this server' : ''}.`)
            .setFooter({ text: "Use /premium redeem to activate a premium key" })
        ]
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(COLORS.premium)
      .setTitle(`⭐ Premium Status`)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL()
      });
    
    if (hasUserPremium && userPremiums.length > 0) {
      for (const premium of userPremiums) {
        const expiresText = premium.expiresAt 
          ? `<t:${Math.floor(premium.expiresAt.getTime() / 1000)}:F>`
          : "Never";
        
        embed.addFields({
          name: `⭐ ${PREMIUM_TYPE_NAMES[premium.premiumType] || premium.premiumType}`,
          value: [
            `**Status:** ✅ Active`,
            `**Type:** ${premium.entityType}`,
            `**Expires:** ${expiresText}`,
            `**Activated:** <t:${Math.floor(premium.activatedAt.getTime() / 1000)}:R>`
          ].join("\n"),
          inline: false
        });
      }
    }
    
    if (serverPremium) {
      const expiresText = serverPremium.expiresAt 
        ? `<t:${Math.floor(serverPremium.expiresAt.getTime() / 1000)}:F>`
        : "Never";
      
      embed.addFields({
        name: `🏠 Server Premium`,
        value: [
          `**Server:** ${interaction.guild.name}`,
          `**Status:** ✅ Active`,
          `**Expires:** ${expiresText}`,
          `**Activated by:** <@${serverPremium.activatedBy}>`
        ].join("\n"),
        inline: false
      });
    }
    
    return interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error("Error checking premium:", error);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.error)
          .setDescription(`❌ Error checking premium status.`)
      ]
    });
  }
}

async function handleInfo(interaction) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.premium)
    .setTitle(`⭐ Premium Plans`)
    .setDescription([
      "Unlock all premium features of our bots!",
      "",
      "**💰 Paid Plans:**",
      "• **5€/month** - Universal (all bots)",
      "• **3€/month** - Per individual bot",
      "• **5€/month** - AI Website",
      "• **10€/month** - Complete Pack (web + all bots)",
      "",
      "**🎬 Promotions (free):**",
      "• Create a YouTube video promoting the bot",
      "• As long as the video is public, you'll have premium",
      "• Contact support to activate this method",
      "",
      "**How to get premium?**",
      "Contact support or the developer to acquire your premium key.",
      "",
      "**Already have a key?**",
      "Use `/premium redeem` to activate it."
    ].join("\n"))
    .setFooter({ text: "Thanks for supporting the project ❤️" })
    .setTimestamp();
  
  // Add button to support server
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/SrSMRxfUEj')
        .setEmoji('🔧')
    );
  
  return interaction.reply({ embeds: [embed], components: [row] });
}

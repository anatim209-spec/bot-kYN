import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("الغاء حظر شخص بالسيرفر")
        .addUserOption(option =>
            option
                .setName("المستهدف")
                .setDescription("اكتب (id) الشخص")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("السبب")
                .setDescription("اكتب سبب فك الحظر")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Unban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unban'
            });
            return;
        }

        try {
                const targetUser = interaction.options.getUser("المستهدف");
                const reason = interaction.options.getString("السبب") || "No reason provided";

                
                const result = await ModerationService.unbanUser({
                    guild: interaction.guild,
                    user: targetUser,
                    moderator: interaction.member,
                    reason
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "✅ User Unbanned",
                            `Successfully unbanned **${targetUser.tag}** from the server.\n\n**Reason:** ${reason}\n**Case ID:** #${result.caseId}`
                        )
                    ]
                });
        } catch (error) {
            logger.error('Unban command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'unban_failed' });
        }
    }
};




import { EmbedBuilder } from 'discord.js';
import { getTicketData, saveTicketData } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { getGuildConfig } from '../../services/guildConfig.js';

const STAR_LABELS = {
    '1': '⭐ 1 — ',
    '2': '⭐⭐ 2 — ',
    '3': '⭐⭐⭐ 3 — ',
    '4': '⭐⭐⭐⭐ 4 — ',
    '5': '⭐⭐⭐⭐⭐ 5 — ',
};

const feedbackHandler = {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        // args = [guildId, channelId, rating]
        const [guildId, channelId, ratingStr] = args;

        if (!guildId || !channelId || !ratingStr) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Feedback Link')
                        .setDescription('This feedback link appears to be malformed.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        let ticketData;
        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load ticket data', { guildId, channelId, error: err.message });
        }

        if (!ticketData) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Ticket Not Found')
                        .setDescription('Could not find the ticket associated with this survey.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ لا')
                        .setDescription('Only the ticket creator can submit feedback for this ticket.')
                        .setColor(getColor('error')),
                ],
                ephemeral: true,
            });
            return;
        }

        if (ticketData.feedback?.rating) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Already Submitted')
                        .setDescription(`You already rated this ticket **${STAR_LABELS[String(ticketData.feedback.rating)]}**.\nThank you for your feedback!`)
                        .setColor(getColor('success')),
                ],
                components: [],
            });
            return;
        }

        const rating = parseInt(ratingStr, 10);
        const ratingLabel = STAR_LABELS[String(rating)] ?? `${rating} stars`;

        try {
            ticketData.feedback = {
                rating,
                submittedAt: new Date().toISOString(),
            };
            await saveTicketData(guildId, channelId, ticketData);
        } catch (err) {
            logger.error('ticketFeedback: failed to save feedback', { guildId, channelId, rating, error: err.message });
        }

        // Send feedback to logs channel
        try {
            const guildConfig = await getGuildConfig(interaction.client, guildId);
            if (guildConfig.ticketLogsChannelId) {
                const logsChannel = await interaction.client.channels.fetch(guildConfig.ticketLogsChannelId).catch(() => null);
                if (logsChannel && logsChannel.isSendable()) {
                    const feedbackEmbed = new EmbedBuilder()
                        .setTitle('📋 Ticket Feedback Received')
                        .setDescription('User submitted feedback for a ticket')
                        .setColor(getColor('info'))
                        .addFields(
                            { name: 'Ticket ID', value: `\`${channelId}\``, inline: true },
                            { name: 'Rating', value: ratingLabel, inline: true },
                            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                        )
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setFooter({ text: `User ID: ${interaction.user.id}` })
                        .setTimestamp();

                    await logsChannel.send({ embeds: [feedbackEmbed] });
                }
            }
        } catch (err) {
            logger.warn('ticketFeedback: failed to send log', { guildId, channelId, error: err.message });
        }

        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('✅ شكرا لارسال تقييمك!')
                    .setDescription(`تم ارسال تقييمك للدعم الفني **${ratingLabel}**.\n\nشكرا لتعاونك `)
                    .setColor(getColor('success'))
                    .setFooter({ text: 'شكرا لارسال للدعم الفني عن مشكلتك.' })
                    .setTimestamp(),
            ],
            components: [],
        });

        logger.info('Ticket feedback submitted', {
            guildId,
            channelId,
            userId: interaction.user.id,
            rating,
        });
    },
};

const declineHandler = {
    name: 'ticket_feedback_decline',

    async execute(interaction) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('👋لا توجد مشكلة!')
                    .setDescription('شكرا لتعاونك.')
                    .setColor(getColor('default')),
            ],
            components: [],
        });
    },
};

export default [feedbackHandler, declineHandler];

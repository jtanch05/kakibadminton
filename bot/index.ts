
import { Telegraf } from 'telegraf';
import 'dotenv/config';
import {
    upsertUser,
    setPaymentQr,
    getUser,
    createSession,
    getSession,
    updateSession,
    addParticipant,
    removeParticipant,
    getParticipants,
    getParticipantCount,
    createPaymentRecords,
    markPaymentPaid,
    getPaymentStatus,
    setPaymentProof
} from './db.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
}

const bot = new Telegraf(token);

// Middleware to track users
bot.use((ctx, next) => {
    if (ctx.from) {
        upsertUser({
            id: ctx.from.id,
            first_name: ctx.from.first_name,
            username: ctx.from.username,
        });
    }
    return next();
});

// Helper function to format session message
function formatSessionMessage(sessionId: number): string {
    const session = getSession(sessionId);
    const participants = getParticipants(sessionId);
    const count = participants.length;

    let message = `🏸 Badminton Session\n\n`;

    if (session.location) {
        message += `📍 ${session.location}\n`;
    }
    if (session.datetime) {
        message += `⏰ ${session.datetime}\n`;
    }

    message += `\nPlayers (${count}):\n`;

    if (count === 0) {
        message += `No one has joined yet\n`;
    } else {
        participants.forEach((p, index) => {
            const displayName = p.username ? `@${p.username}` : p.first_name;
            const hostLabel = p.user_id === session.host_id ? ' (host)' : '';
            message += `${index + 1}. ${displayName}${hostLabel}\n`;
        });
    }

    return message;
}

// Helper function to format payment status
function formatPaymentStatus(sessionId: number): string {
    const paymentStatus = getPaymentStatus(sessionId);
    const session = getSession(sessionId);

    if (!paymentStatus || paymentStatus.length === 0) {
        return '';
    }

    const paidCount = paymentStatus.filter(p => p.payment_status === 'paid').length;
    const totalCount = paymentStatus.length;

    let statusText = `\n💰 Payment Status (${paidCount}/${totalCount}):\n`;

    paymentStatus.forEach(p => {
        const displayName = p.username ? `@${p.username}` : p.first_name;
        const hostLabel = p.user_id === session.host_id ? ' (host)' : '';
        const icon = p.payment_status === 'paid' ? '✅' : '⏳';
        const statusLabel = p.payment_status === 'paid' ? 'Paid' : 'Pending';
        statusText += `${icon} ${displayName}${hostLabel} - ${statusLabel}\n`;
    });

    if (paidCount === totalCount) {
        statusText += `\n🎉 All payments received!\n`;
    }

    return statusText;
}

// Helper function to update session message
async function updateSessionMessage(ctx: any, sessionId: number) {
    const session = getSession(sessionId);
    if (!session || !session.message_id) return;

    const message = formatSessionMessage(sessionId);
    const botUsername = ctx.botInfo?.username || 'Kaki_Badminton_Bot';
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ I\'m In', callback_data: `join_${sessionId}` },
                { text: '❌ Can\'t Make It', callback_data: `leave_${sessionId}` }
            ],
            [
                {
                    text: '💰 Calculate Bill',
                    url: `https://t.me/${botUsername}/bill?startapp=${sessionId}_${session.host_id}`
                }
            ]
        ]
    };
    try {
        await ctx.telegram.editMessageText(
            session.group_id,
            session.message_id,
            undefined,
            message,
            {
                reply_markup: keyboard
            }
        );
    } catch (error) {
        console.error('Failed to update session message:', error);
    }
}

bot.command('start', async (ctx) => {
    const args = ctx.message.text.split(' ')[1]; // Get the argument after /start

    // Check if this is a bill redirect from group
    if (args && args.startsWith('bill_')) {
        const sessionId = parseInt(args.replace('bill_', ''));
        const session = getSession(sessionId);

        if (!session) {
            ctx.reply('❌ Session not found. It may have been deleted.');
            return;
        }

        // Get host info
        const hostUser = getUser(session.host_id);
        const hostName = hostUser?.first_name || 'Host';

        // Send message with web_app button (works in private chat)
        await ctx.reply(
            `💰 Calculate Bill for Session #${sessionId}\n\n` +
            `Host: ${hostName}\n` +
            `Click the button below to open the calculator.`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '🔢 Open Calculator',
                            web_app: {
                                url: `${process.env.MINI_APP_URL}?session=${sessionId}&hostId=${session.host_id}&hostName=${encodeURIComponent(hostName)}`
                            }
                        }
                    ]]
                }
            }
        );
        return;
    }

    // Default welcome message
    ctx.reply('Welcome to KakiBadminton! 🏸\n\nI help you split bills and get paid.\n\n1. Use /setqr to save your DuitNow/TnG QR.\n2. Use /newsession to create a badminton session.\n3. Open the Mini App to calculate bills.');
});

bot.command('newsession', async (ctx) => {
    const text = ctx.message.text.replace('/newsession', '').trim();

    // Parse the text for location and time (simple parsing)
    // Format: /newsession Location @ Time
    let location = '';
    let datetime = '';

    if (text.includes('@')) {
        const parts = text.split('@');
        location = parts[0].trim();
        datetime = parts[1]?.trim() || '';
    } else {
        location = text;
    }

    // Create session in database
    const sessionId = createSession({
        group_id: ctx.chat.id,
        host_id: ctx.from.id,
        title: 'Badminton Session',
        location: location || undefined,
        datetime: datetime || undefined
    });

    // Add host as first participant
    addParticipant(sessionId, ctx.from.id, ctx.from.first_name, ctx.from.username);

    // Create inline keyboard with Calculate Bill button
    // Use t.me/bot/app format for Mini App (works in groups when configured in BotFather)
    const botUsername = ctx.botInfo?.username || 'Kaki_Badminton_Bot';
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ I\'m In', callback_data: `join_${sessionId}` },
                { text: '❌ Can\'t Make It', callback_data: `leave_${sessionId}` }
            ],
            [
                {
                    text: '💰 Calculate Bill',
                    url: `https://t.me/${botUsername}/bill?startapp=${sessionId}_${ctx.from.id}`
                }
            ]
        ]
    };

    const message = formatSessionMessage(sessionId);

    const sentMessage = await ctx.reply(message, {
        reply_markup: keyboard
    });

    // Update session with message_id
    updateSession(sessionId, { message_id: sentMessage.message_id });
});

bot.command('setqr', (ctx) => {
    ctx.reply('Please reply to this message with your payment QR code image (Photo).');
});

bot.on('photo', async (ctx) => {
    // Check if this is a payment QR upload
    if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message && ctx.message.reply_to_message.text.includes('payment QR code')) {
        const bestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
        setPaymentQr(ctx.from.id, bestPhoto.file_id);
        ctx.reply('✅ Payment QR saved! When you generate a bill, this QR will be shown to your friends.');
        return;
    }

    // Check if this is a payment proof upload
    const pendingPayments = (global as any).pendingPayments || {};
    const pendingPayment = pendingPayments[ctx.from.id];

    if (pendingPayment) {
        const { sessionId } = pendingPayment;
        const session = getSession(sessionId);

        if (!session) {
            await ctx.reply('❌ Session not found');
            return;
        }

        // Store payment proof
        const bestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
        setPaymentProof(sessionId, ctx.from.id, bestPhoto.file_id);

        // Mark as paid
        markPaymentPaid(sessionId, ctx.from.id);

        // Clear pending payment
        delete pendingPayments[ctx.from.id];

        // Confirm to user
        await ctx.reply('✅ Payment proof received! Your payment has been marked as paid.');

        // Update bill message in group
        try {
            const paymentStatus = formatPaymentStatus(sessionId);
            const participants = getParticipants(sessionId);
            const payments = getPaymentStatus(sessionId);
            const userPayment = payments.find(p => p.user_id === ctx.from.id);
            const amount = userPayment?.amount || 0;
            const hostUser = getUser(session.host_id);

            let message = `🏸 Badminton Bill 🏸\n\n` +
                `💰 Total: RM${(amount * participants.length).toFixed(2)}\n` +
                `👤 Per Person: RM${amount.toFixed(2)}\n\n`;

            message += `Players (${participants.length}):\n`;
            participants.forEach(p => {
                const name = p.username ? `@${p.username}` : p.first_name;
                message += `• ${name}\n`;
            });
            message += '\n';

            message += `Pay to Host: @${hostUser?.username || ctx.from.first_name}\n` +
                `(Court: RM${session.court_fee}, Shuttles: RM${(amount * participants.length - session.court_fee).toFixed(2)})`;

            message += paymentStatus;

            // Check if all paid
            const allPaid = payments.every(p => p.payment_status === 'paid');
            const keyboard = allPaid ? undefined : {
                inline_keyboard: [[
                    { text: `💰 I've Paid RM${amount.toFixed(2)}`, callback_data: `paid_${sessionId}` }
                ]]
            };

            await ctx.telegram.editMessageCaption(
                session.group_id,
                session.bill_message_id,
                undefined,
                message,
                { reply_markup: keyboard }
            );
        } catch (error) {
            console.error('Failed to update bill message:', error);
        }
    }
});

// Handle callback queries for RSVP and payments
bot.on('callback_query', async (ctx) => {
    // Type guard: check if callback query has data property
    if (!('data' in ctx.callbackQuery)) return;

    const data = ctx.callbackQuery.data;
    if (!data) return;

    // Handle RSVP callbacks
    if (data.startsWith('join_')) {
        const sessionId = parseInt(data.replace('join_', ''));
        addParticipant(sessionId, ctx.from.id, ctx.from.first_name, ctx.from.username);
        await updateSessionMessage(ctx, sessionId);
        await ctx.answerCbQuery('✅ You\'re in! 🎉');
    }

    if (data.startsWith('leave_')) {
        const sessionId = parseInt(data.replace('leave_', ''));
        removeParticipant(sessionId, ctx.from.id);
        await updateSessionMessage(ctx, sessionId);
        await ctx.answerCbQuery('❌ Removed from session');
    }

    // Handle payment callbacks
    if (data.startsWith('paid_')) {
        const sessionId = parseInt(data.replace('paid_', ''));
        const session = getSession(sessionId);

        if (!session) {
            await ctx.answerCbQuery('❌ Session not found');
            return;
        }

        // Prompt user to send payment proof
        await ctx.answerCbQuery('📸 Please send payment screenshot');

        // Send prompt message in private chat
        await ctx.telegram.sendMessage(
            ctx.from.id,
            `📸 Payment Proof Required\n\n` +
            `Please send a screenshot of your payment to confirm.\n\n` +
            `Amount: RM${getPaymentStatus(sessionId).find(p => p.user_id === ctx.from.id)?.amount.toFixed(2) || '0.00'}\n` +
            `Pay to: Host\n\n` +
            `Reply to this message with your payment screenshot.`,
            {
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: 'Send payment screenshot...'
                }
            }
        );

        // Store pending payment info temporarily (we'll use a simple in-memory store)
        // In production, you'd want to use Redis or database
        (global as any).pendingPayments = (global as any).pendingPayments || {};
        (global as any).pendingPayments[ctx.from.id] = {
            sessionId,
            messageId: ctx.callbackQuery.message?.message_id
        };
    }
});

bot.on('message', async (ctx) => {
    // Handle web_app_data
    if ('web_app_data' in ctx.message) {
        const data = ctx.message.web_app_data.data;
        try {
            const bill = JSON.parse(data);
            if (bill.type === 'settle') {
                const host = ctx.from;
                const hostData = getUser(host.id);
                const qrFileId = hostData?.payment_qr_file_id;

                let message = `🏸 Badminton Bill 🏸\n\n` +
                    `💰 Total: RM${bill.total.toFixed(2)}\n` +
                    `👤 Per Person: RM${bill.perPerson.toFixed(2)}\n\n`;

                // If session ID is provided, include participant list and create payment records
                let sessionId = bill.sessionId;
                if (sessionId) {
                    const session = getSession(sessionId);
                    const participants = getParticipants(sessionId);

                    if (participants.length > 0) {
                        message += `Players (${participants.length}):\n`;
                        participants.forEach(p => {
                            const name = p.username ? `@${p.username}` : p.first_name;
                            message += `• ${name}\n`;
                        });
                        message += '\n';
                    }

                    // Create payment records for all participants
                    createPaymentRecords(sessionId, bill.perPerson);

                    // Set payment deadline (24 hours from now)
                    const deadline = new Date();
                    deadline.setHours(deadline.getHours() + 24);

                    // Update session status
                    updateSession(sessionId, {
                        status: 'settled',
                        court_fee: bill.court,
                        shuttles_used: bill.shuttlesUsed || 0,
                        settled_at: new Date().toISOString(),
                        payment_deadline: deadline.toISOString()
                    });
                }

                message += `Pay to Host: @${host.username || host.first_name}\n` +
                    `(Court: RM${bill.court}, Shuttles: RM${bill.shuttles.toFixed(2)})`;

                // Add payment status if session exists
                if (sessionId) {
                    message += formatPaymentStatus(sessionId);
                }

                // Create inline keyboard with "I've Paid" button
                const keyboard = sessionId ? {
                    inline_keyboard: [[
                        { text: `💰 I've Paid RM${bill.perPerson.toFixed(2)}`, callback_data: `paid_${sessionId}` }
                    ]]
                } : undefined;

                if (qrFileId) {
                    const sentMessage = await ctx.replyWithPhoto(qrFileId, {
                        caption: message,
                        reply_markup: keyboard
                    });

                    // Store bill message ID
                    if (sessionId) {
                        updateSession(sessionId, { bill_message_id: sentMessage.message_id });
                    }
                } else {
                    const sentMessage = await ctx.reply(message, { reply_markup: keyboard });

                    // Store bill message ID
                    if (sessionId) {
                        updateSession(sessionId, { bill_message_id: sentMessage.message_id });
                    }

                    ctx.reply('💡 Tip: Use /setqr to attach your DuitNow QR automatically next time!');
                }
            }
        } catch (e) {
            console.error('Failed to parse web_app_data', e);
        }
    }
});

bot.launch(() => {
    console.log('Bot is running!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

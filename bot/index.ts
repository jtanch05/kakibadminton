
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
    getParticipantCount
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

    let message = `🏸 *Badminton Session*\n\n`;

    if (session.title && session.title !== 'Badminton Session') {
        message += `📝 ${session.title}\n`;
    }
    if (session.location) {
        message += `📍 ${session.location}\n`;
    }
    if (session.datetime) {
        message += `⏰ ${session.datetime}\n`;
    }

    message += `\n*Players (${count}):*\n`;

    if (count === 0) {
        message += `_No one has joined yet_\n`;
    } else {
        participants.forEach((p, index) => {
            const name = p.username ? `@${p.username}` : p.first_name;
            const hostLabel = p.user_id === session.host_id ? ' (host)' : '';
            message += `${index + 1}. ${name}${hostLabel}\n`;
        });
    }

    return message;
}

// Helper function to update session message
async function updateSessionMessage(ctx: any, sessionId: number) {
    const session = getSession(sessionId);
    if (!session || !session.message_id) return;

    const message = formatSessionMessage(sessionId);
    const keyboard = {
        inline_keyboard: [[
            { text: '✅ I\'m In', callback_data: `join_${sessionId}` },
            { text: '❌ Can\'t Make It', callback_data: `leave_${sessionId}` }
        ], [
            {
                text: '💰 Settle Bill',
                web_app: {
                    url: `${process.env.MINI_APP_URL || 'https://your-app.com'}?session=${sessionId}`
                }
            }
        ]]
    };

    try {
        await ctx.telegram.editMessageText(
            session.group_id,
            session.message_id,
            undefined,
            message,
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    } catch (error) {
        console.error('Failed to update session message:', error);
    }
}

bot.command('start', (ctx) => {
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

    // Create inline keyboard
    const keyboard = {
        inline_keyboard: [[
            { text: '✅ I\'m In', callback_data: `join_${sessionId}` },
            { text: '❌ Can\'t Make It', callback_data: `leave_${sessionId}` }
        ], [
            {
                text: '💰 Settle Bill',
                web_app: {
                    url: `${process.env.MINI_APP_URL || 'http://localhost:5173'}?session=${sessionId}`
                }
            }
        ]]
    };

    const message = formatSessionMessage(sessionId);

    const sentMessage = await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });

    // Update session with message_id
    updateSession(sessionId, { message_id: sentMessage.message_id });
});

bot.command('setqr', (ctx) => {
    ctx.reply('Please reply to this message with your payment QR code image (Photo).');
});

bot.on('photo', (ctx) => {
    if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message && ctx.message.reply_to_message.text.includes('payment QR code')) {
        const bestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
        setPaymentQr(ctx.from.id, bestPhoto.file_id);
        ctx.reply('✅ Payment QR saved! When you generate a bill, this QR will be shown to your friends.');
    }
});

// Handle callback queries for RSVP
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (!data) return;

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
});

bot.on('message', (ctx) => {
    // Handle web_app_data
    if ('web_app_data' in ctx.message) {
        const data = ctx.message.web_app_data.data;
        try {
            const bill = JSON.parse(data);
            if (bill.type === 'settle') {
                const host = ctx.from;
                const hostData = getUser(host.id);
                const qrFileId = hostData?.payment_qr_file_id;

                let message = `🏸 *Badminton Bill* 🏸\n\n` +
                    `💰 *Total*: RM${bill.total.toFixed(2)}\n` +
                    `👤 *Per Person*: RM${bill.perPerson.toFixed(2)}\n\n`;

                // If session ID is provided, include participant list
                if (bill.sessionId) {
                    const session = getSession(bill.sessionId);
                    const participants = getParticipants(bill.sessionId);

                    if (participants.length > 0) {
                        message += `*Players (${participants.length}):*\n`;
                        participants.forEach(p => {
                            const name = p.username ? `@${p.username}` : p.first_name;
                            message += `• ${name}\n`;
                        });
                        message += '\n';
                    }

                    // Update session status
                    updateSession(bill.sessionId, {
                        status: 'settled',
                        court_fee: bill.court,
                        shuttles_used: bill.shuttlesUsed || 0
                    });
                }

                message += `Pay to Host: @${host.username || host.first_name}\n` +
                    `(Court: RM${bill.court}, Shuttles: RM${bill.shuttles.toFixed(2)})`;

                if (qrFileId) {
                    ctx.replyWithPhoto(qrFileId, { caption: message, parse_mode: 'Markdown' });
                } else {
                    ctx.reply(message, { parse_mode: 'Markdown' });
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

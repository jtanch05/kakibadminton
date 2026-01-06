
import { Telegraf } from 'telegraf';
import 'dotenv/config';
import { upsertUser, setPaymentQr, getUser } from './db.js';

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

bot.command('start', (ctx) => {
    ctx.reply('Welcome to KakiBadminton! 🏸\n\nI help you split bills and get paid.\n\n1. Use /setqr to save your DuitNow/TnG QR.\n2. Open the Mini App to calculate bills.');
});

bot.command('setqr', (ctx) => {
    ctx.reply('Please reply to this message with your payment QR code image (Photo).');
});

bot.on('photo', (ctx) => {
    // Check if this is a reply to a /setqr instruction
    // For simplicity in MVP, we assume any photo sent to private chat or valid reply is setting QR if intent is there. 
    // Improve: Check reply_to_message or session state.
    // For now: Just check if the text context or previous command implies it?
    // Let's make it explicit via reply for better UX, or just any photo with caption "/setqr"?
    // Simplest: Check if message is a reply to the bot's request.

    if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message && ctx.message.reply_to_message.text.includes('payment QR code')) {
        const bestPhoto = ctx.message.photo[ctx.message.photo.length - 1]; // Highest res
        setPaymentQr(ctx.from.id, bestPhoto.file_id);
        ctx.reply('✅ Payment QR saved! When you generate a bill, this QR will be shown to your friends.');
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

                const message = `🏸 *Badminton Bill* 🏸\n\n` +
                    `💰 *Total*: RM${bill.total.toFixed(2)}\n` +
                    `👤 *Per Person*: RM${bill.perPerson.toFixed(2)}\n\n` +
                    `Pay to Host: @${host.username || host.first_name}\n` +
                    `(Ali: RM${bill.court}, Shuttles: RM${bill.shuttles.toFixed(2)})`;

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

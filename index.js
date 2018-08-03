const Telegraf = require('telegraf');
const session = require('telegraf/session');
const GoogleSpreadsheet = require('google-spreadsheet');
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const creds = JSON.parse(process.env.creds);
const sheetID = process.env.SHEET_ID;

// Google piece based on this tutorial from Twillio - https://www.twilio.com/blog/2017/03/google-spreadsheets-and-javascriptnode-js.html
// Create a document object using the ID of the spreadsheet - obtained from its URL.
const doc = new GoogleSpreadsheet(sheetID);

// Authenticate with the Google Spreadsheets API.
function addToSpreadSheet(data) {
    doc.useServiceAccountAuth(creds, function (err) {
        doc.addRow(1, data, function (err) {
            if (err) {
                console.log(err);
            }
        });
    });
}

// // Register session middleware
bot.use(session());

// Register logger middleware
bot.use((ctx, next) => {
    const start = new Date();
    return next().then(() => {
        const ms = new Date() - start;
        console.log('response time %sms', ms);
    });
});

// Text messages handling
bot.hears(/^nominate$/i, (ctx) => {
    if (!ctx.message.reply_to_message) {
        ctx.replyWithMarkdown(`Please reply to the message you want to nominate`);
    } else {
        data = {
            nominee: ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name,
            message: ctx.message.reply_to_message.text,
            nominator: ctx.message.from.first_name + " " + ctx.message.from.last_name,
            date: new Date().toString(),
            channel: ctx.message.chat.title
        };
        addToSpreadSheet(data);
        ctx.replyWithMarkdown(`Thanks for your nomination. It's safely stored in a database that Karl can't get to`);
        console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
    }

});

bot.startPolling();
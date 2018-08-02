const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const session = require('telegraf/session');
const fs = require('fs');
const readline = require('readline');
const google = require('googleapis');
const reply = Telegraf;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
var authFilePath = process.env.CREDS_FILE;
var GoogleSpreadsheet = require('google-spreadsheet');
var async = require('async');
var creds = require('CREDS_FILE');
var sheetID = process.env.SHEET_ID;

// Create a document object using the ID of the spreadsheet - obtained from its URL.
var doc = new GoogleSpreadsheet(sheetID);

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
bot.hears('nominate', (ctx) => {
    if (!ctx.message.reply_to_message) {
        ctx.replyWithMarkdown(`Please reply to the message you want to nominate`);
    } else {
        data = {
            nominee: ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name,
            message: ctx.message.reply_to_message.text,
            nominator:  ctx.message.from.first_name + " " + ctx.message.from.last_name,
            date: new Date().toString(),
            channel: ctx.message.chat.title
        };
        addToSpreadSheet(data);
        ctx.replyWithMarkdown(`Thanks for your nomination. Its safely stored in a database that Karl can't get to`);
        console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
    }

});

bot.startPolling();
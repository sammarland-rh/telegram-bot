// dotenv parsing
require('dotenv').config();

// packages
const Telegraf = require('telegraf');
const fetch = require('isomorphic-fetch');
const session = require('telegraf/session');
const GoogleSpreadsheet = require('google-spreadsheet');
const Dropbox = require('dropbox').Dropbox;
const https = require('https');
const fs = require('fs');
const debug = require('debug')('telegram-bot');

// Credentials and other runtime config
const telegramToken = process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(telegramToken);
const dropboxToken = process.env.DROPBOX_TOKEN;
const writePath = process.env.WRITE_PATH;
const creds = require('./creds.json');
const sheetID = process.env.SHEET_ID;
const dropboxURL = "https://www.dropbox.com/home";

// Filepaths in DropBox
const gifPath = "/telegram-bot/gifs";
const photosPath = "/telegram-bot/photos";

// Google piece based on this tutorial from Twillio - https://www.twilio.com/blog/2017/03/google-spreadsheets-and-javascriptnode-js.html
// Create a document object using the ID of the spreadsheet - obtained from its URL.
const doc = new GoogleSpreadsheet(sheetID);
var dbx = new Dropbox({
    accessToken: dropboxToken
});

// Authenticate with the Google Spreadsheets API.
function addToSpreadSheet(data) {
    doc.useServiceAccountAuth(creds, function (err) {
        if(err){
            console.log(err);
        }
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

// Keep track of nominated IDs to avoid duplicates
// Only works for this bot instance (lost on restart), but it should help catch simple race conditions and duplicate hears() invocations
const nominatedIds = [];

// Text messages handling
bot.hears(/^nominate$/i, (ctx) => {
    if (!ctx.message.reply_to_message) {
        ctx.telegram.sendMessage(ctx.message.chat.id, `Please reply to the message you want to nominate`, {
            reply_to_message_id: ctx.message.message_id
        });
        return;
    } else if (nominatedIds.includes(ctx.message.reply_to_message.message_id)) {
        debug(`message ${ctx.message.reply_to_message.message_id} already seen - ignoring`);
        return;
    } else {
        nominatedIds.push(ctx.message.reply_to_message.message_id);
        data = {
            nominee: ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name,
            message: ctx.message.reply_to_message.text,
            nominator: ctx.message.from.first_name + " " + ctx.message.from.last_name,
            date: new Date().toString(),
            channel: ctx.message.chat.title,
            linkToGif: "N/A",
            linkToPhoto: "N/A"
        };
        // This gets the information about the gifs
        if (ctx.message.reply_to_message.animation) {
            fileId = ctx.message.reply_to_message.animation.file_id;
            ctx.telegram.getFile(fileId).then(function (response) {
                fileName = fileId + ".mp4";
                filePath = writePath + fileName;
                var file = fs.createWriteStream(filePath);
                var request = https.get("https://api.telegram.org/file/bot" + telegramToken + "/" + response.file_path, function (response) {
                    response.pipe(file).on("finish", function () {
                        uploadFile = fs.readFileSync(filePath);
                        dbx.filesUpload({
                                path: gifPath + "/" + fileName,
                                contents: uploadFile,
                                autorename: true
                            })
                            .then(function (response) {
                                data.linkToGif = dropboxURL + response.path_lower;
                                data.message = "N/A";
                                addToSpreadSheet(data);
                                ctx.telegram.sendMessage(ctx.message.chat.id, `${ctx.message.from.first_name} nominated this message!  It's safely stored in a database that Karl can't get to.`, {
                                  reply_to_message_id: ctx.message.reply_to_message.message_id
                                });
                                console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
                            })
                            .catch(function (error) {
                                console.error(error);
                            }).finally(() => {
                                fs.unlinkSync(filePath);
                            });
                    });
                });

            });
        } else if (ctx.message.reply_to_message.photo) {
            // This is where the photo logic happens
            fileId = ctx.message.reply_to_message.photo[2].file_id;
            ctx.telegram.getFile(fileId).then(function (response) {
                extenstion = response.file_path.split(".")[1];
                fileName = response.file_id + "." + extenstion;
                filePath = writePath + fileName;
                var file = fs.createWriteStream(filePath);
                var request = https.get("https://api.telegram.org/file/bot" + telegramToken + "/" + response.file_path, function (response) {
                    response.pipe(file).on("finish", function () {
                        uploadFile = fs.readFileSync(filePath);
                        dbx.filesUpload({
                                path: photosPath + "/" + fileName,
                                contents: uploadFile,
                                autorename: true
                            })
                            .then(function (response) {
                                data.linkToPhoto = dropboxURL + response.path_lower;
                                data.message = "N/A";
                                addToSpreadSheet(data);
                                ctx.telegram.sendMessage(ctx.message.chat.id, `${ctx.message.from.first_name} nominated this message!  It's safely stored in a database that Karl can't get to.`, {
                                  reply_to_message_id: ctx.message.reply_to_message.message_id
                                });
                                console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
                            })
                            .catch(function (error) {
                                console.error(error);
                            })
                            .finally(() => {
                                fs.unlinkSync(filePath);
                            });
                    });
                });
            });
        } else {
            addToSpreadSheet(data);
            // Use ctx.telegram.sendMessage because ctx.replyX don't seem to properly reply
            // Reply to the nominated message
            // This might help in cases where the bot runs into problems - trace what the bot is replying to
            ctx.telegram.sendMessage(ctx.message.chat.id, `${ctx.message.from.first_name} nominated this message!  It's safely stored in a database that Karl can't get to.`, {
              reply_to_message_id: ctx.message.reply_to_message.message_id
            });
            console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
        }
    }

});

bot.startPolling();

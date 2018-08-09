// packages
const Telegraf = require('telegraf');
const fetch = require('isomorphic-fetch');
const session = require('telegraf/session');
const GoogleSpreadsheet = require('google-spreadsheet');
const Dropbox = require('dropbox').Dropbox;
const https = require('https');
const fs = require('fs');

// Credentials and other runtime config
const telegramToken = process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(telegramToken);
const dropboxToken = process.env.DROPBOX_TOKEN;
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
            channel: ctx.message.chat.title,
            linkToGif: "N/A",
            linkToPhoto: "N/A"
        };
        // This gets the information about the gifs
        if (ctx.message.reply_to_message.animation) {
            fileId = ctx.message.reply_to_message.animation.file_id;
            ctx.telegram.getFile(fileId).then(function (response) {
                fileName = fileId + ".mp4";
                var file = fs.createWriteStream(fileName);
                var request = https.get("https://api.telegram.org/file/bot" + telegramToken + "/" + response.file_path, function (response) {
                    response.pipe(file).on("finish", function () {
                        uploadFile = fs.readFileSync(fileName);
                        dbx.filesUpload({
                                path: gifPath + "/" + fileName,
                                contents: uploadFile,
                                autorename: true
                            })
                            .then(function (response) {
                                data.linkToGif = dropboxURL + response.path_lower;
                                addToSpreadSheet(data);
                                ctx.replyWithMarkdown(`Thanks for your nomination. It's safely stored in a database that Karl can't get to`);
                                console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
                            })
                            .catch(function (error) {
                                console.error(error);
                            });
                        fs.unlinkSync(fileName);
                    });
                });

            });
        } else if (ctx.message.reply_to_message.photo) {
            // This is where the photo logic happens
            fileId = ctx.message.reply_to_message.photo[4].file_id;
            ctx.telegram.getFile(fileId).then(function (response) {
                extenstion = response.file_path.split(".")[1];
                fileName = response.file_id + "." + extenstion;
                var file = fs.createWriteStream(fileName);
                var request = https.get("https://api.telegram.org/file/bot" + telegramToken + "/" + response.file_path, function (response) {
                    response.pipe(file).on("finish", function () {
                        uploadFile = fs.readFileSync(fileName);
                        dbx.filesUpload({
                                path: photosPath + "/" + fileName,
                                contents: uploadFile,
                                autorename: true
                            })
                            .then(function (response) {
                                data.linkToPhoto = dropboxURL + response.path_lower;
                                addToSpreadSheet(data);
                                ctx.replyWithMarkdown(`Thanks for your nomination. It's safely stored in a database that Karl can't get to`);
                                console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
                            })
                            .catch(function (error) {
                                console.error(error);
                            });
                        fs.unlinkSync(fileName);
                    });
                });
            });
        } else {
            addToSpreadSheet(data);
            ctx.replyWithMarkdown(`Thanks for your nomination. It's safely stored in a database that Karl can't get to`);
            console.log("Message the was nominated was " + ctx.message.reply_to_message.text + "\nNominated By " + ctx.message.reply_to_message.from.first_name + " " + ctx.message.reply_to_message.from.last_name);
        }
    }

});

bot.startPolling();
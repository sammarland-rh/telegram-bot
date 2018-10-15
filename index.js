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
const debug = require('debug')('telegram-bot:debug');
const trace = require('debug')('telegram-bot:trace');
const error = require('debug')('telegram-bot:error');

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

// // Register session middleware
bot.use(session());

// Register logger middleware
bot.use((ctx, next) => {
    const start = new Date();
    return next().then(() => {
        const ms = new Date() - start;
        trace('response time %sms', ms);
    });
});

// Keep track of nominated IDs to avoid duplicates
// Only works for this bot instance (lost on restart), but it should help catch simple race conditions and duplicate hears() invocations
const nominatedIds = [];

// Error handling
bot.catch((err) => {
  error('Something went horribly wrong.  Swallow the error.', err);
});

// Text messages handling
bot.hears(/^nominate$/i, (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.telegram.sendMessage(ctx.message.chat.id, `Please reply to the message you want to nominate.`, {
            reply_to_message_id: ctx.message.message_id
        }).catch(err => {
            error(err);
            return Promise.reject(err);
        });
    } else if (nominatedIds.includes(ctx.message.reply_to_message.message_id)) {
        debug(`message ${ctx.message.reply_to_message.message_id} already seen - ignoring`);
        return;
    } else {
        const data = {
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
            const fileId = ctx.message.reply_to_message.animation.file_id;
            return downloadFileFromTelegram(ctx, fileId, 'mp4').then(uploadFileToDropbox.bind(null, gifPath)).then(response => {
                data.linkToGif = dropboxURL + response.path_lower;
                data.message = "N/A";
                return saveNomination(ctx, data);
            });
        } else if (ctx.message.reply_to_message.photo) {
            // Find the photo we want
            const photo = ctx.message.reply_to_message.photo.reduce((acc, currVal) => {
                return !acc ? currVal : (acc.width > currVal.width ? acc : currVal);
            }, null);
            if (!photo)  {
              error(`screwy photo in message ${ctx.message.reply_to_message.message_id}`);
              return;
            }
            const fileId = photo.file_id;
            return downloadFileFromTelegram(ctx, fileId).then(uploadFileToDropbox.bind(null, photosPath)).then(response => {
                data.linkToPhoto = dropboxURL + response.path_lower;
                data.message = "N/A";
                return saveNomination(ctx, data);
            });
        } else {
            return saveNomination(ctx, data);
        }
    }

});

bot.startPolling();

const downloadFileFromTelegram = function(ctx, fileId, defaultExtension) {
    // Get file *information* from Telegram
    return ctx.telegram.getFile(fileId).then(response => {
        const extension = defaultExtension || response.file_path.split(".")[1];
        return new Promise((resolve, reject) => {
            const filePath = `${writePath}/${fileId}.${extension}`;
            const file = fs.createWriteStream(filePath);
            // Now *download* it somewhere temporary
            const request = https.get("https://api.telegram.org/file/bot" + telegramToken + "/" + response.file_path, response => {
                response.pipe(file).on("finish", () => {
                    return resolve(filePath);
                }).on("error", err => {
                    return reject(err);
                });
            });
        });
    }).catch(err => {
        error(err);
        return Promise.reject(err);
    });
};

const uploadFileToDropbox = function(destinationPath, filePath) {
    // Get the fileName
    const fileName = filePath.match(/^.+\/([^/]+?)$/)[1];
    // Load the file into memory
    const file = fs.readFileSync(filePath);
    if (!file) {
        return Promise.reject('could not read temporary file');
    }
    return dbx.filesUpload({
            path: `${destinationPath}/${fileName}`,
            contents: file,
            autorename: true
        })
        .catch(function(err) {
            error(err);
            return Promise.reject(err);
        })
        .finally(() => {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                // Meh
            }
        });
};

const saveNomination = function(ctx, data) {
    return updateSpreadsheet(data).then(() => {
        // Use ctx.telegram.sendMessage because ctx.replyX don't seem to properly reply
        // Reply to the nominated message
        // This might help in cases where the bot runs into problems - trace what the bot is replying to
        return ctx.telegram.sendMessage(ctx.message.chat.id, `${ctx.message.from.first_name} nominated this message!  It's safely stored in a database that Karl can't get to.`, {
            reply_to_message_id: ctx.message.reply_to_message.message_id
        }).then(() => {
            debug(`${data.nominator} nominated message '${data.message} with ID ${ctx.message.message_id}'`);
            // Don't re-process stuff we've seen already
            nominatedIds.push(ctx.message.reply_to_message.message_id);
        }).catch(err => {
            if (err.description === "Forbidden: bot was kicked from the group chat") {
              // Meh - we saved it, we don't HAVE to tell anyone about it
              return Promise.resolve();
            }
            error(err);
            return Promise.reject(err);
        });
    });
};

const updateSpreadsheet = function(data) {
    return new Promise((resolve, reject) => {
        // Authenticate with the Google Spreadsheets API.
        doc.useServiceAccountAuth(creds, function(err) {
            if (err) {
                error(err);
                return reject(err);
            }
            // Add a row
            doc.addRow(1, data, function(err) {
                if (err) {
                    error(err);
                    return reject(err);
                }
                return resolve();
            });
        });
    });
};

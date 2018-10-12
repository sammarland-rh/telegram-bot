### Telegram Nomination Bot

This bot is built to capture quotes from a telegram group and store them in a google sheet.

The bot will capture any text that is in a message that is replied to with the word 'nominate'

For example:

Person A - "I am so funny"
Person B replied to the comment - "Nominate"
Bot will store "I am so funny" along with the channel name, nominee, nominator and the date.

## Installing Dependancies

This is a node app so running `npm install` from the project directory will install the dependancies required to run the app.

## Setup Google integration

* Go to the [Google APIs Console](https://console.developers.google.com/)
* Create a new project.
* Click Enable API. Search for and enable the Google Drive API.
* Create credentials for a Web Server to access Application Data.
* Name the service account and grant it a Project Role of Editor.
* Download the JSON file.
* Copy the JSON file to your code directory and rename it to client_secret.json
* Invite the email address that is in the JSON file to your spreadsheet so it has access

More information here - https://www.twilio.com/blog/2017/03/google-spreadsheets-and-javascriptnode-js.html

## Setup the Bot

To create a new bot you have to follow [this guide](https://core.telegram.org/bots#6-botfather)

Once you have your token you need to change the privacy setting of your bot so that it captures every message in a channel instead of just ones directed at it.

Send a message to BotFather:

* `/setprivacy`
* Then reply with your bot name including the @ for example `@naminatebot`
* Then reply with `Disable`

## Configuration
The code expects some environment variables to be provided, and will respect [dotenv](https://www.npmjs.com/package/dotenv) usage.

See `.env.template` for details.

## Running the app
There are many ways to run Node apps. The simples is to run `node index.js' You will need to make sure the environment variables are correctly set for the application to start.

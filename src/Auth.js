const { app, BrowserWindow } = require('electron');

const { google } = require('googleapis');

const path = require('path');

const fs = require('fs');

const SCOPES = [
  // 'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];
const TOKEN_PATH = path.join(__dirname + '/token.json');
const CREDENTIALS_PATH = path.join(__dirname + '/cred/credentials.json');

const credentials = require(CREDENTIALS_PATH);

const { client_secret, client_id, redirect_uris } = credentials.installed;

class Auth {
  oAuth2Client;
  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);
  }

  authorize() {
    console.log('some info authorize');
    // const authUrl = this.oAuth2Client.generateAuthUrl({
    //   access_type: 'offline',
    //   scope: SCOPES,
    //   prompt: 'select_account ',
    // });

    // const authWindow = new BrowserWindow({
    //   width: 1000,
    //   height: 800,
    //   webPreferences: {
    //     nodeIntegration: true,
    //     contextIsolation: false,
    //   },
    // });

    // authWindow.loadURL(authUrl);

    // authWindow.webContents.on('will-redirect', (e, url) => {
    //   const queryParams = new URL(url).searchParams;
    //   const code = queryParams.get('code');

    //   if (code) {
    //     this.oAuth2Client.getToken(code, async (err, token) => {
    //       this.oAuth2Client.setCredentials(token);

    //       this.oAuth2Client.on('tokens', (newToken) => {
    //         if (newToken.refresh_token) {
    //           {
    //             token.refresh_token = newToken.refresh_token;
    //             fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    //           }
    //         }
    //       });

    //       fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    //         if (err) {
    //           console.error('Error saving access token: ', err.message);
    //         }

    //         console.log('Access token stored in token.json');
    //       });

    //       authWindow.close();

    //       mainWindow.loadURL(`http://localhost:3000/form`);
    //     });
    //   }
    // });
  }
}

module.exports = Auth;

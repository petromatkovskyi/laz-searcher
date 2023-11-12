const { app, BrowserWindow, ipcMain } = require('electron');
const { dialog } = require('electron');

const express = require('express');

const appExpress = express();

const fs = require('fs');

const { google } = require('googleapis');

const path = require('path');

const SCOPES = [
  // 'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const TOKEN_PATH = path.join(__dirname + '/token.json');

const CREDENTIALS_PATH = path.join(__dirname + '/cred/credentials2.json');

let mainWindow;

const credentials = require(CREDENTIALS_PATH);

const { client_secret, client_id, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);

appExpress.get('/', (req, res) => {
  res.sendFile(__dirname + '/welcome.html');
});

appExpress.get('/form', (req, res) => {
  res.sendFile(__dirname + '/form.html');
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.openDevTools();

  mainWindow.loadURL('http://localhost:3000');

  // mainWindow.loadFile(path.join(__dirname + '/welcome.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

function authorize() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  const authWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  authWindow.loadURL(authUrl);

  authWindow.webContents.on('will-redirect', (e, url) => {
    const queryParams = new URL(url).searchParams;
    const code = queryParams.get('code');

    if (code) {
      oAuth2Client.getToken(code, async (err, token) => {
        oAuth2Client.setCredentials(token);

        oAuth2Client.on('tokens', (newToken) => {
          if (newToken.refresh_token) {
            {
              token.refresh_token = newToken.refresh_token;
              fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
            }
          }
        });

        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) {
            console.error('Error saving access token: ', err.message);
          }

          console.log('Access token stored in token.json');
        });

        authWindow.close();

        mainWindow.loadURL(`http://localhost:3000/form`);
      });
    }
  });
}

ipcMain.handle('auth', async (req) => {
  authorize();
});

ipcMain.handle('findNewFiles', async (req) => {
  exampleUsage();

  const result = await searchNewSections();
  return result;
});

ipcMain.handle('downloadFiles', (req, data) => {
  const ROOT_SEARCHING_PATH =
    '//mggp-server.mggplviv.local/uk2/23028-00_GUGiK_Hybryda_jesien';
  const ROOT_COPING_PATH = 'C:/lidar/capap';
  const { block, fileNames } = data;
  const blockPath = path.join(ROOT_COPING_PATH, block);

  let destinationFolderPath;

  if (!fs.existsSync(blockPath)) {
    fs.mkdirSync(blockPath);
    console.log(`Folder '${block}' was created.`);
  } else {
    console.log(`Folder '${block}' have already exist.`);

    // Знаходимо всі папки в середині блоку
    const subFolders = fs
      .readdirSync(blockPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    if (subFolders.length > 0) {
      // Визначаємо останню створену папку
      const lastFolder = subFolders.sort((a, b) => parseInt(b) - parseInt(a))[0];
      const nextFolderNumber = parseInt(lastFolder) + 1;

      // Створюємо нову папку в середині блоку
      const newFolderPath = path.join(blockPath, nextFolderNumber.toString());
      fs.mkdirSync(newFolderPath);

      destinationFolderPath = newFolderPath;

      console.log(`Folder '${nextFolderNumber}' is created in '${block}'.`);
    } else {
      // Якщо папок взагалі немає, створюємо папку '1'
      const newFolderPath = path.join(blockPath, '1');
      fs.mkdirSync(newFolderPath);

      destinationFolderPath = newFolderPath;
      console.log(`Folder '1' is created in '${block}'.`);
    }
  }

  try {
    const searchingPath = `${ROOT_SEARCHING_PATH}/${block}/LAZ`;
    const isSucceed = new Promise((res, rej) => {
      fileNames.forEach((fileName) => {
        const searchingFileName = `${searchingPath}/${fileName}.laz`;
        const fullName = path.basename(searchingFileName);
        const destinationFilePath = path.join(destinationFolderPath, fullName);
        fs.copyFile(
          searchingFileName,
          destinationFilePath,
          fs.constants.COPYFILE_EXCL,
          async (err) => {
            if (err) {
              console.error('error:', err);
              rej(err);
            } else {
              console.log('success');
              res(true);
            }
          }
        );
      });
    })
      .then((data) => data)
      .catch((err) => false);
  } catch (e) {
    console.log(error.message);
    return false;
  }
});

ipcMain.handle('choosePath', () => {
  dialog
    .showOpenDialog({
      properties: ['openDirectory'],
      title: 'Виберіть папку',
      defaultPath: '/',
      buttonLabel: 'Вибрати',
    })
    .then((result) => {
      if (!result.canceled) {
        const folderPath = result.filePaths[0];
        console.log(`Ви вибрали папку: ${folderPath}`);
        // Тут ви можете використовувати шлях до папки (folderPath) за потребою
      } else {
        console.log('Вибір папки скасований.');
      }
    })
    .catch((err) => {
      console.error(err);
    });
});

appExpress.listen(3000, () => {
  console.log('app is listening on port 3000');
});

//1C3h0lm22AkvPjUDSs_SrfPq_DvHUo2ynLzGn16LB5ow
// 1qxsExCtcIRZbqHcHSdmwixoEDuW8Qg1QoS68iIKYfI4

async function searchNewSections() {
  const auth = oAuth2Client;

  if (!auth.credentials.access_token) {
    throw new Error('Access token is missing. Please authenticate first.');
  }

  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = '1qxsExCtcIRZbqHcHSdmwixoEDuW8Qg1QoS68iIKYfI4'; // ID вашої таблиці
  const sheetId = 'Облік_23028-00_GUGiK_Hybryda_jesien'; // Назва аркуша, на якому потрібно здійснити пошук

  const range = `${sheetId}`;

  const FIND_OPERATOR = 'Матковський Петро';
  const DATE_REG_EX = /^\d{2}.\d{2}$/;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values;
    if (!values || values.length === 0) {
      throw new Error('У таблиці немає даних.');
    }

    const results = [];
    for (let i = 0; i < values.length; i++) {
      const operatorCell = values[i][4];

      const rowNumber = i + 1;
      const block = values[i][1]; // Колонка B
      const section = values[i][3]; // Колонка D
      const operator = values[i][4]; // Колонка E
      const done = values[i][6]; // Колонка G
      const check = values[i][9]; // Колонка J

      if (
        operatorCell &&
        operatorCell.includes(FIND_OPERATOR) &&
        done === '0,000' &&
        check === undefined &&
        !check?.match(DATE_REG_EX)
      ) {
        results.push({ num: rowNumber, block, section, operator, done, check });
      }
    }

    console.log(`There are cells were found ${FIND_OPERATOR}:`, results);
    return results;
  } catch (error) {
    console.error(`Помилка при отриманні даних з Google Sheets: ${error.message}`);
    throw error;
  }
}

// Використання функції searchDjinni
async function exampleUsage() {
  try {
    const result = await searchNewSections();
    console.log('Returned result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

//дописати функціонал включно з скачуванням та правильним збереженням тобто автоматичне пропискування шляху а потім додати ручне задання параметрів пошуку починаючи з таблиці листа і до специфічних рядків які потрібно знайти

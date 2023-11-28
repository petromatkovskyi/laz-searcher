const { app, BrowserWindow, ipcMain } = require('electron');
const { dialog } = require('electron');
const express = require('express');
const appExpress = express();
const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');
const { exec } = require('child_process');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const { operators } = require(path.join(__dirname + '/OPERATORS.json'));
// const TOKEN_PATH = path.join(__dirname + '/token.json');
// const SETUP_PATH = path.join(__dirname + '/setup.json');
const SETUP_PATH = path.join(app.getPath('userData'), 'setup.json');
const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json');

const CREDENTIALS_PATH = path.join(__dirname + '/cred/credentials.json');

let mainWindow;

const credentials = require(CREDENTIALS_PATH);

const { client_secret, client_id, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);

appExpress.get('/', (req, res) => {
  res.sendFile(__dirname + '/welcome.html'); //! welcome
});

appExpress.get('/form', (req, res) => {
  res.sendFile(__dirname + '/form.html');
});

app.on('ready', async () => {
  // createWindow(true);

  const token = await checkAccessToken();
  if (token) {
    createWindow(true);

    getSheetTitles(); //eliminate
  } else {
    createWindow(false);
  }
});

oAuth2Client.on('tokens', (newToken) => {
  console.log('27 check event tokens', newToken);
});

ipcMain.handle('auth', async (req) => {
  authorize();
});

ipcMain.handle('findNewFiles', async (req) => {
  const result = await searchNewSections();
  return result;
});

ipcMain.handle('checkFolders', checkFolders);

ipcMain.handle('choosePath', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choose directory',
      defaultPath: '/',
      buttonLabel: 'Choose',
    });

    if (!result.canceled) {
      const folderPath = result.filePaths[0];
      console.log(`You have chosen directory: ${folderPath}`);
      // Тут ви можете використовувати шлях до папки (folderPath) за потребою
      return folderPath;
    } else {
      console.log('Choosing was denied.');
      return null;
    }
  } catch (err) {
    console.error(err);
    return null;
  }
});

ipcMain.handle('saveSetups', (req, data) => {
  const {
    rootSearchingPath,
    rootDestPath,
    operatorName,
    spreadsheetLink,
    spreadsheetId,
    sheetName,
    pathType,
  } = data;

  if (
    rootSearchingPath &&
    rootDestPath &&
    operatorName &&
    spreadsheetLink &&
    spreadsheetId &&
    sheetName &&
    pathType &&
    operators.includes(operatorName)
  ) {
    fs.writeFileSync(SETUP_PATH, JSON.stringify(data), (err) => {
      if (err) {
        console.error('Error saving setups: ', err.message);
      }
      console.log('Setups stored in setup.json');
    });

    // fs.writeFile(SETUP_PATH, JSON.stringify(data), (err) => {
    //   if (err) {
    //     console.error('Error saving setups: ', err.message);
    //   }
    //   console.log('Setups stored in setup.json');
    // });

    return { success: true, message: 'Setups are saved' };
  } else if (operators.includes(operatorName)) {
    return { success: false, message: 'Operator is not appropriate' };
  }
});

ipcMain.handle('getSetups', getSetups);

ipcMain.handle('downloadFile', downloadFile);

ipcMain.handle('unArchive', unArchive);

ipcMain.handle('getSheetTitles', async (req, data) => await getSheetTitles(data));

async function authorize() {
  return new Promise((res, rej) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'select_account ',
    });

    // console.log('authUrl', authUrl);

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
      // console.log('url', url);
      const queryParams = new URL(url).searchParams;
      const code = queryParams.get('code');

      if (code) {
        oAuth2Client.getToken(code, async (err, token) => {
          oAuth2Client.setCredentials(token);

          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) {
              console.error('Error saving access token: ', err.message);
            }

            console.log('Access token stored in token.json');
          });

          authWindow.close();

          mainWindow.loadURL(`http://localhost:3000/form`);
          res();
        });
      }
    });
  });
}

function createWindow(isAuth) {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isRedirect = isAuth ? '/form' : '';

  // mainWindow.webContents.openDevTools();
  mainWindow.loadURL(`http://localhost:3000${isRedirect}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function checkAccessToken(clientToken) {
  let token = clientToken || null;
  try {
    if (!clientToken) {
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf8');
      token = JSON.parse(tokenData);
    }

    if (token && token.expiry_date > Date.now()) {
      oAuth2Client.setCredentials(token);

      return true;
    } else if (token && token.refresh_token) {
      await refreshAccessToken(token.refresh_token);

      return true;
    } else {
      await authorize();
      return null;
    }
  } catch (error) {
    console.error('Error while reading file: ', error.message);
    return null;
  }
}

async function refreshAccessToken(refreshToken) {
  return await new Promise((resolve, reject) => {
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    oAuth2Client.refreshAccessToken((err, newToken) => {
      if (err) {
        reject(err);
      } else {
        oAuth2Client.setCredentials(newToken);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken));

        resolve(newToken);
      }
    });
  });
}

function getSetups() {
  try {
    const data = fs.readFileSync(SETUP_PATH, 'utf8');

    const jsonData = JSON.parse(data);
    return jsonData;
  } catch (err) {
    console.error('Error getting JSON:', err);
    throw err;
  }
}

async function searchNewSections() {
  const auth = oAuth2Client;

  await checkAccessToken(auth.credentials);

  const { spreadsheetId, sheetName, operatorName } = getSetups();

  const sheets = google.sheets({ version: 'v4', auth });

  const range = `${sheetName}`;

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
        operatorCell.includes(operatorName) &&
        done === '0,000' &&
        (check === undefined || !check?.match(DATE_REG_EX))
      ) {
        results.push({ num: rowNumber, block, section, operator, done, check });
      }
    }

    // console.log(`There are cells were found ${operatorName}:`, results);
    return results;
  } catch (error) {
    console.error(`Помилка при отриманні даних з Google Sheets: ${error.message}`);
    throw error;
  }
}

async function getSheetTitles(data) {
  const auth = oAuth2Client;

  await checkAccessToken(auth.credentials);

  const { spreadsheetId } = data?.spreadsheetId ? data : getSetups();

  if (!spreadsheetId) {
    throw new Error('Spreed sheet id empty');
  }

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetsInfo = response.data.sheets;
    const sheetTitles = sheetsInfo.map((sheet) => sheet.properties.title);

    return sheetTitles;
  } catch (error) {
    console.error('Error getting sheet titles:', error.message);
    throw error;
  }
}

async function checkFolders(req, data) {
  const { rootSearchingPath, rootDestPath, pathType } = getSetups();
  const { block, fileNames } = data;
  const blockPath = path.join(rootDestPath, block);

  let destinationFolderPath;

  if (!fs.existsSync(blockPath)) {
    fs.mkdirSync(blockPath);
    destFolderNum = 1;

    const newFolderPath = path.join(blockPath, '1');
    fs.mkdirSync(newFolderPath);

    destinationFolderPath = newFolderPath;

    console.log(`Folder '1' is created in '${block}'.`);

    console.log(`Folder '${block}' was created.`);
  } else {
    console.log(`Folder '${block}' have already exist.`);

    const subFolders = fs
      .readdirSync(blockPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    if (subFolders.length > 0) {
      const lastFolder = subFolders.sort((a, b) => parseInt(b) - parseInt(a))[0];

      const lastFolderPath = path.join(blockPath, lastFolder);

      console.log('laz', lastFolderPath, !isDirectoryHas('.laz', lastFolderPath));
      console.log('las', !isDirectoryHas('.las', lastFolderPath));

      if (
        !isDirectoryHas('.laz', lastFolderPath) &&
        !isDirectoryHas('.las', lastFolderPath)
      ) {
        destinationFolderPath = lastFolderPath;
      } else {
        const nextFolderNumber = parseInt(lastFolder) + 1;

        const newFolderPath = path.join(blockPath, nextFolderNumber.toString());
        fs.mkdirSync(newFolderPath);

        destinationFolderPath = newFolderPath;

        console.log(`Folder '${nextFolderNumber}' is created in '${block}'.`);
      }
    } else {
      const newFolderPath = path.join(blockPath, '1');
      destinationFolderPath = 1;
      fs.mkdirSync(newFolderPath);

      destinationFolderPath = newFolderPath;
      console.log(`Folder '1' is created in '${block}'.`);
    }
  }

  const searchingPath =
    pathType === 'root' ? `${rootSearchingPath}/${block}/LAZ` : rootSearchingPath;

  try {
    // const files = fs.readdirSync(searchingPath);
    // files.some((file) => path.extname(file) === '.laz')
    return { searchingPath, destinationFolderPath };
  } catch (error) {
    console.error('Error checking for .laz files:', error.message);
    return false;
  }
}

async function downloadFile(req, data) {
  const {
    foldersPaths: { searchingPath, destinationFolderPath },
    fileName,
  } = data;

  try {
    const isSucceed = new Promise((res, rej) => {
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
    })
      .then((data) => data)
      .catch((err) => false);

    return await isSucceed;
  } catch (e) {
    console.log(error.message);
    return false;
  }
}

function isDirectoryHas(type, directoryPath) {
  const regex = new RegExp(`${type}$`);
  try {
    const files = fs.readdirSync(directoryPath);
    return files.some((file) => regex.test(file));
  } catch (error) {
    console.error('Error checking if directory is empty:', error.message);
    return false;
  }
}

async function copyFiles(sourceFolder, targetFolder, files) {
  for (const file of files) {
    const sourcePath = path.join(sourceFolder, file);
    const targetPath = path.join(targetFolder, file);
    await fs.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL, async (err) => {
      if (err) {
        console.error('error:', err);
      } else {
        console.log('success');
      }
    });
    console.log(`File '${file}' copied to '${targetFolder}'.`);
  }
}

function createBatFile(destinationFolderPath) {
  const batContent = `@echo off
cd "${destinationFolderPath}"
laszip -i *.laz -olas
del *.laz  rem
exit`;

  const batFilePath = path.join(destinationFolderPath, 'laz-searcher_laz_to_las.bat');

  fs.writeFileSync(batFilePath, batContent);

  console.log(`.bat file created at: ${batFilePath}`);
}

async function unArchive(req, folderPath) {
  try {
    const sourceFilesFolder = path.join(__dirname, '/serviceFiles');
    const targetFilesFolder = folderPath;

    if (!isDirectoryHas('.laz', targetFilesFolder)) return null;

    await copyFiles(sourceFilesFolder, targetFilesFolder, ['laszip.exe']);

    const batFilePath = path.join(targetFilesFolder, 'laz-searcher_laz_to_las.bat');

    createBatFile(targetFilesFolder);

    exec(`start "" "${batFilePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error of execution .bat file: ${error.message}`);
        return;
      }
      console.log('Execution .bat file was over.');
    });
  } catch (error) {
    console.error('Error in function unArchive:', error.message);
  }
}

appExpress.listen(3000, () => {
  console.log('app is listening on port 3000');
});

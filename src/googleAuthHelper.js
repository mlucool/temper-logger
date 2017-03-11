import readline from 'readline';
import GoogleAuth from 'google-auth-library';
import Promise from 'bluebird';
import path from 'path';

const fs = Promise.promisifyAll(require('fs'));

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_DIR = path.join((process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE), '.credentials/');
const TOKEN_PATH = path.join(TOKEN_DIR, 'sheets.googleapis.com-nodejs-quickstart.json');

export function getClientSecret(location = path.join(__dirname, 'client_secret.json')) {
    return fs.readFileAsync(location)
        .then((content) => JSON.parse(content))
        .catch((err) => {
            console.log(`Error loading client secret files from ${location}: ${err.toString()}`);
            throw err;
        });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 */
export function authorize(credentials) {
    const clientSecret = credentials.installed.client_secret;
    const clientId = credentials.installed.client_id;
    const redirectUrl = credentials.installed.redirect_uris[0];
    const auth = new GoogleAuth();
    const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    return new Promise((resolve, reject) => {
        // Check if we have previously stored a token.
        fs.readFileAsync(TOKEN_PATH)
            .then((token) => {
                oauth2Client.credentials = JSON.parse(token); // We should warn if this throws
                resolve(oauth2Client);
            }).catch((err) => getNewToken(oauth2Client))
            .then(resolve)
            .catch(reject);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 */
function getNewToken(oauth2Client, callback) {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // eslint-disable-line
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve, reject) => {
        try {
            rl.question('Enter the code from that page here: ', (code) => {
                rl.close();
                oauth2Client.getToken(code, (err, token) => {
                    if (err) {
                        console.log('Error while trying to retrieve access token', err);
                        reject(new Error(`Error while trying to retrieve access token ${err.toString()}`));
                        return;
                    }
                    oauth2Client.credentials = token; // eslint-disable-line
                    storeToken(token);
                    resolve(oauth2Client);
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log(`Token stored to ${TOKEN_PATH}`);
}

import google from 'googleapis';
import Promise from 'bluebird';
import _ from 'lodash';
import {getTemperDevices, mock as temperMock} from 'temper-usb';

import * as googleAuthHelper from './googleAuthHelper';

const sheets = google.sheets('v4');
sheets.spreadsheets.values = Promise.promisifyAll(sheets.spreadsheets.values);

const fields = ['date', 'data.0'];

/**
 * This will start a timer to take periodic temps from a TEMPer USB and pushes them to a Google Sheet
 * @param {boolean} mock
 * @param {string} spreadsheetId Google spreadsheet ID
 * @param {Number} poll How often to pull (ms)
 * @param {Number} printEvery Print every printEvery data points (i.e. every poll*printEvery ms)
 * @param {String{ secretPath Path a client_secret.json
 * @returns {Promise.<void>}
 */
export default async function logger({mock, spreadsheetId, poll, printEvery, secretPath}) {
    console.log(`Welcome to temp logger, logging to ${spreadsheetId} every ${poll}${mock ? '(mocked)' : ''}.`);
    const tds = mock ? [new temperMock.MockTemperDevice()] : getTemperDevices();
    if (_.size(tds) === 0) {
        console.error('No devices found!');
        process.exit(1);
    }
    console.log(`Found ${_.size(tds)} TEMPer USBs`);
    let oauth2Client;
    try {
        const credentials = await googleAuthHelper.getClientSecret(secretPath);
        // Authorize a client with the loaded credentials
        oauth2Client = await googleAuthHelper.authorize(credentials);
        console.log('Logged in!');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    let count = 0;
    const takeAndRecordTemp = async function takeAndRecordTemp() {
        try {
            // Use Google Sheets API
            // await listMajors(oauth2Client);
            const temps = await Promise.all(tds.map((td) => td.getTemperature('f')));
            const mappedTemps = temps.map((reading) => {
                // Make into dates that we would enter
                if (reading.date) {
                    reading.date = new Date(reading.date).toLocaleString('us').replace(',', ''); // eslint-disable-line
                }
                return fields.map((field) => _.get(reading, field));
            });
            ++count;
            if (count === 1 || (printEvery && count % printEvery === 0)) {
                console.log(`Reading #${count}: ${mappedTemps}`);
            }
            await appendValues(spreadsheetId, oauth2Client, mappedTemps);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    };

    console.log(`Taking temp every ${poll / 1000.0}s`);
    setInterval(takeAndRecordTemp, poll);
    await takeAndRecordTemp(); // Run one right away
}

function appendValues(spreadsheetId, auth, values) {
    return sheets.spreadsheets.values.appendAsync({
        auth,
        spreadsheetId,
        range: 'Sheet1!A1:A',
        valueInputOption: 'USER_ENTERED',
        resource: {
            values
        }
    });
}

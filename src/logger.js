import google from 'googleapis';
import Promise from 'bluebird';
import _ from 'lodash';
import {getTemperDevices, mock as temperMock} from 'temper-usb';

import * as googleAuthHelper from './googleAuthHelper';

const sheets = google.sheets('v4');
sheets.spreadsheets.values = Promise.promisifyAll(sheets.spreadsheets.values);

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVQXYZ';
const fields = ['date', 'data.0', 'data.1'];
const headers = ['date', 'Temperature1 F', 'Temperature2 F'];
/**
 * This will start a timer to take periodic temps from a TEMPer USB and pushes them to a Google Sheet
 * @param {boolean} mock
 * @param {string} spreadsheetId Google spreadsheet ID
 * @param {Number} poll How often to pull (ms)
 * @param {Number} printEvery Print every printEvery data points (i.e. every poll*printEvery ms)
 * @param {String{ secretPath Path a client_secret.json
 * @returns {Promise.<void>}
 */
export default async function logger({mock, spreadsheetId, poll, poll2, printEvery, secretPath}) {
    console.log(`Welcome to temp logger, logging to ${spreadsheetId} every ${poll}${mock ? '(mocked)' : ''}.`);
    if (poll % poll2 !== 0) {
        console.error('Poll must be divisible by poll2');
        process.exit(1);
    }
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
    const mainSheetRatio = poll / poll2;
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
            if (count === 1 || count % mainSheetRatio === 0) {
                await appendValues(spreadsheetId, oauth2Client, mappedTemps);
            }
            await updateLatestValues(spreadsheetId, oauth2Client, mappedTemps);
            // Recover from errors by just printing them and keep going
        } catch (err) {
            console.error(err);
        }
    };

    console.log(`Taking temp every ${poll2 / 1000.0}s (also every ${poll / 1000.0} s)`);
    setInterval(takeAndRecordTemp, poll2);
    await takeAndRecordTemp(); // Run one right away
}

let firstAppend = true;
async function appendValues(spreadsheetId, auth, values) {
    if (firstAppend) {
        firstAppend = false;
        await sheets.spreadsheets.values.updateAsync({
            auth,
            spreadsheetId,
            range: `Sheet1!A1:${AZ[fields.length]}1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [headers]
            }
        });
    }
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

let updatedSheetRows;
async function updateLatestValues(spreadsheetId, auth, values, maxRows = 100) {
    const totalRows = maxRows + 1; // One for header
    const range = `Sheet2!A1:${AZ[fields.length]}${totalRows}`;
    if (!updatedSheetRows) { // Only the first time grab data to elimiante some calls
        const response = await sheets.spreadsheets.values.getAsync({
            auth,
            spreadsheetId,
            range
        });
        updatedSheetRows = response.values || [];
    }
    if (updatedSheetRows.length === 0) {
        updatedSheetRows.unshift(headers);
    }
    updatedSheetRows.splice(1, 0, ...values);
    updatedSheetRows = _.take(updatedSheetRows, totalRows);
    return sheets.spreadsheets.values.updateAsync({
        auth,
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: updatedSheetRows
        }
    });
}

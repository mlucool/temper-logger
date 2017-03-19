#!/usr/bin/env node

require('babel-polyfill');

const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const fs = require('fs');
const path = require('path');
const logger = require('./logger').default;

const options = [
    {
        name: 'spreadsheetId',
        alias: 'i',
        type: String,
        description: 'Spreadsheet to append',
        defaultValue: '1chDUWfJN__BwnfehtEgRnA81iA619Qpze7-nBWfT3Hs'
    },
    {name: 'mock', alias: 'm', type: Boolean, description: 'Use mock data', defaultValue: false},
    {name: 'poll', alias: 'p', type: Number, description: 'How often to poll (ms)', defaultValue: 30 * 60 * 1000},
    {
        name: 'poll2',
        alias: 'c',
        type: Number,
        description: 'How often to poll for sheet 2 (circular) (ms)',
        defaultValue: 5 * 60 * 1000
    },
    {name: 'printEvery', type: Number, description: 'Every N data points, print to console', defaultValue: 2},
    {name: 'secretPath', alias: 's', type: Number, description: 'Path to client_secret.json for Google API'},
    {name: 'help', alias: 'h', type: Boolean, description: 'Show this documentation'}
];

const args = commandLineArgs(options);
if (args.help) {
    const sections = [
        {
            header: 'A TEMPer reader',
            content: 'Reader for a temper USB. See: https://www.npmjs.com/package/temper'
        },
        {
            header: 'Options',
            optionList: options
        }
    ];
    console.log(getUsage(sections));
    process.exit(0);
}

// Best effort to guess where secret it
if (!args.secretPath) {
    args.secretPath = process.cwd();
}
if (fs.existsSync(args.secretPath) && fs.lstatSync(args.secretPath).isDirectory()) {
    args.secretPath = path.join(args.secretPath, 'client_secret.json');
}
if (!fs.existsSync(args.secretPath)) {
    console.log('You must specify a valid secretPath for your google API keys! e.g. /path/to/client_secret.json');
    process.exit(1);
}

logger(args);

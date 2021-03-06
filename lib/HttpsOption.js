'use strict';

const fs = require('fs');
const EventEmitter = require('events');

const InitStatus = new EventEmitter();
let options;

/**
 * init module by given config object
 * 
 * @param {Object} config path to { ca, key, cert }
 */
function init(config) {
    let done = 0;
    let total = Object.getOwnPropertyNames(config).length;
    for (let key in config) {
        fs.readFile(config[key], (err, data) => {
            if (!options) options = {};
            if (err) return console.warn(`[HttpsOption] Invalid https config "${key}".`);
            options[key] = data.toString();
            done++;
            if (done == total) InitStatus.emit('finish', options);
        });
    }
}

/**
 * get httpsOptions and callback
 * callback(err, opt)
 * 
 * @param {Object} config path to { ca, key, cert }
 * @param {function} callback callback(err, opt)
 */
function get(config, callback) {
    init(config);
    InitStatus.on('finish', opt => {
        if (!opt) return callback(new Error('Https options config file invalid.'));
        callback(null, opt);
    });
}

module.exports = {
    get: get
};
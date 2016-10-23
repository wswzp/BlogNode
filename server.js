'use strict';

const https = require('https');
const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');

const Logger = require('./lib/Logger');
const Config = require('./lib/Config');
const NeteaseApi = require('./lib/NeteaseApiAndroid');
const HttpsOption = require('./lib/HttpsOption');
const HeaderBuilder = require('./lib/HeaderBuilder');
const ArchiveReader = require('./lib/ArchiveReader');
const ViewPageBuilder = require('./lib/ViewPageBuilder');

const root = path.resolve('.');
const logger = new Logger.Logger();

let regexs = {
    nodeVersion: /\$\{process\.versions\.node\}/,
    extName: /\.([\w\d]+?)$/
};

function ServerHandler(request, response) {
    /**path name in url */
    let pathName = url.parse(request.url).pathname;
    /**file path based on operation system*/
    let filePath = path.join(root, pathName);
    /**request fileName / maybe unuseable */
    let fileName = path.basename(filePath);
    if (pathName == '/') {
        pathName = './page/index.html';
        filePath = path.join(root, pathName);
    }
    logger.log(`[Router] ${request.method}: ${pathName} -> ${filePath}`);
    if (request.method === 'GET') {
        if (pathName.indexOf('/api/') >= 0) {
            // this is a api request
            switch (pathName) {
                case '/api/archive-list':
                    response.writeHead(200, HeaderBuilder.build('json'));
                    ArchiveReader.getSummaryList(e => response.end(JSON.stringify(e)));
                    break;
                case '/api/music-record':
                    response.writeHead(200, HeaderBuilder.build('json'));
                    NeteaseApi.get(data => response.end(data));
                    break;
                default:
                    break;
            }
        } else if (request.headers['pushstate-ajax']) {
            // pjax request
            ArchiveReader.getDetail(fileName, (err, archive) => {
                if (!err) {
                    response.writeHead(200, { 'content-Type': 'text/plain' });
                    response.end(JSON.stringify(archive));
                } else {
                    response.writeHead(404, { 'content-Type': 'text/plain' });
                    response.end(err.message);
                }
            });
        } else {
            // try to find and read local file
            fs.stat(filePath, (err, stats) => {
                // no error occured, read file
                if (!err && stats.isFile()) {
                    // get archive by url, must render page on server
                    if (pathName.indexOf('/archive/') >= 0) {
                        ViewPageBuilder.build(path.join(root, pathName), res => {
                            response.writeHead(200, HeaderBuilder.build('html', stats));
                            response.end(res);
                        });
                    } else {
                        // cache for browser
                        if (request.headers['if-modified-since'] == stats.mtime.toUTCString()) {
                            response.writeHead(304, "Not Modified");
                            response.end();
                            return;
                        }
                        // get other resources
                        let extName;
                        try { extName = regexs.extName.exec(pathName)[1]; } catch (e) {}
                        response.setHeader('Content-Length', stats.size);
                        response.writeHead(200, HeaderBuilder.build(extName, stats));
                        fs.createReadStream(filePath).pipe(response);
                    }
                } else {
                    // file not found
                    response.writeHead(200, HeaderBuilder.build('html', stats));
                    fs.createReadStream('./page/current404.html').pipe(response);
                }
            });
        }
    }
}

function RedirectHandler(request, response) {
    if (request.headers.host) {
        let fullUrl = request.headers.host + request.url;
        logger.log(`[Redirect] httpUrl: ${fullUrl}`);
        fullUrl = fullUrl.replace(/\:\d+/, `:${global.httpsPort}`);
        response.writeHead(301, { 'Location': `https://${fullUrl}` });
    }
    response.end();
}

Config.get(path.resolve(root, 'config.json'), opt => {
    /**init Current Version 404 page. */
    fs.readFile(opt.resourcePath['404Page'], (err, data) => {
        let ver = process.version;
        let current404 = data.toString().replace(regexs.nodeVersion, ver);
        let page404 = fs.createWriteStream(path.join(root, '/page/current404.html'));
        page404.end(current404, 'utf8');
    });

    /**init archive view page template */
    fs.readFile(opt.resourcePath['viewPage'], (err, data) => {
        ViewPageBuilder.init(data.toString());
    });

    NeteaseApi.init(opt.addons.netease.uid, opt.addons.netease.expireTime);
    ArchiveReader.init(opt.resourcePath['archive']);

    let server;
    let httpPort = process.env.PORT || opt.server.port || 8080;
    /**if redirect enabled in config */
    if (opt.server.redirectHttpToHttps == true) {
        server = http.createServer(RedirectHandler);
    } else {
        server = http.createServer(ServerHandler);
    }
    server.listen(httpPort);
    logger.log(`[Server] HTTP Server running on http://127.0.0.1:${httpPort}`);

    /**if Https enabled in config */
    if (opt.server.enableHttps === true) {
        HttpsOption.get(opt.httpsOptions, (err, httpsOpt) => {
            if (!err) {
                let httpsServer = https.createServer(httpsOpt, ServerHandler);
                let httpsPort = process.env.HTTPS_PORT || opt.server.httpsPort || 8443;
                global.httpsPort = httpsPort;
                httpsServer.listen(httpsPort);
                logger.log(`[Server] HTTPS Server running on https://127.0.0.1:${httpsPort}`);
            } else {
                logger.log(`[Server] HTTPS not enabled cause ${err.message}`);
            }
        });
    }
});
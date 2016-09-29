'use strict';

const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');

const NeteaseApi = require('./lib/NeteaseApiAndroid');
const ContentType = require('./lib/HtmlContentType');
const ArchiveReader = require('./lib/ArchiveReader');

const root = path.resolve('.');

var regexs = {
    nodeVersion: /\$\{process\.versions\.node\}/,
    archivePath: /archive\/(.+)/,
    arcitleTitle: /\$\{article\.title\}/,
    articleContent: /\$\{article\.content\}/,
    extName: /\w+\.(\w+)$/
}

/**init Current Version 404 page. */
fs.readFile(path.join(root, '/page/404.html'), (err, data) => {
    var ver = process.version;
    var current404 = data.toString().replace(regexs.nodeVersion, ver);
    var page404 = fs.createWriteStream(path.join(root, '/page/current404.html'));
    page404.end(current404, 'utf8');
});

/**init archive view page template */
var plainViewPage;
fs.readFile(path.join(root, '/page/view.html'), (err, data) => {
    plainViewPage = data.toString();
});

NeteaseApi.init(76980626, 4 * 3600 * 1000);
ArchiveReader.init(path.resolve(root, 'archive'));

var server = http.createServer((request, response) => {
    console.log(`[Node Server] ${request.method}: ${request.url}`);
    // path name in url
    var pathName = url.parse(request.url).pathname;
    // file path based on operation system
    var filePath = path.join(root, pathName);
    console.log(`[Node Server] pathName: ${pathName}, filePath: ${filePath}`);
    // console.log(`[Node Server] Request Header: ${JSON.stringify(request.headers)}`);
    if (request.method === 'GET') {
        // this is a api request
        if (pathName.indexOf('/api/') >= 0) {
            switch (pathName) {
                case '/api/archive-list':
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    ArchiveReader.get(e => response.end(JSON.stringify(e)));
                    break;
                case '/api/music-record':
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    NeteaseApi.get(data => response.end(data));
                    break;
                default:
                    break;
            }
            // pjax request
        } else if (request.headers['pushstate-ajax']) {
            fs.stat(filePath, (err, stat) => {
                if (!err && stat.isFile()) {
                    response.writeHead(200, { 'content-Type': 'text/html' });
                    fs.createReadStream(filePath).pipe(response);
                } else {
                    response.writeHead(404, { 'content-Type': 'text/html' });
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
                        let title = regexs.archivePath.exec(pathName)[1];
                        fs.readFile(filePath, (err, data) => {
                            let page = plainViewPage;
                            page = page.replace(regexs.arcitleTitle, title);
                            page = page.replace(regexs.articleContent, data.toString());
                            response.end(page);
                        });
                    } else {
                        let extName;
                        try {
                            extName = regexs.extName.exec(pathName)[1];
                        } catch (e) {}
                        response.writeHead(200, { 'content-Type': ContentType.get(extName) });
                        fs.createReadStream(filePath).pipe(response);
                    }
                    // cannot find file, but received index request
                } else if (!err && pathName == '/') {
                    response.writeHead(200, { 'content-Type': 'text/html' });
                    fs.createReadStream('./page/index.html').pipe(response);
                    // file not found
                } else {
                    response.writeHead(200, { 'content-Type': 'text/html' });
                    fs.createReadStream('./page/current404.html').pipe(response);
                }
            });
        }
    }
});

// Heroku dynamically assigns your app a port,
// so you can't set the port to a fixed number.
// Heroku adds the port to the env,
// so you can pull it from there.
var serverPort = process.env.PORT || 8080;

server.listen(serverPort);

console.log(`[Node Server] Running at http://127.0.0.1:${serverPort}/`);
'use strict';

/**
 * Create Index Article Element. Use Object.node to get the node.
 * 
 * @param {string} fileName
 * @param {string} title
 * @param {string} content
 * @param {string} footnote
 */
function Article(fileName, title, content, footnote) {
    this.node = document.createElement('li');
    this.node.classList.add('stack');
    this.node.innerHTML = [
        `<a href="/archive/${fileName}" class="title">${title}</a>`,
        `<pre class="content">${content}</pre>`,
        `<span class="footnote">${footnote}</span>`,
    ].join('');
    this.node.getElementsByClassName('title')[0].onclick = e => {
        e.preventDefault();
        loadArticleContent(fileName);
    }
}

/**
 * Create Sidebar List Line Element. Use Object.node to get the node.
 * 
 * @param {string} content
 * @param {string} href
 * @param {string} target
 */
function SideListItem(content, href, target) {
    this.node = document.createElement('li');
    this.node.classList.add('side');
    this.node.innerHTML = [
        `<a href="${href}" target="${target}">${content}</a>`
    ].join('');
}

/**
 * Hide article content and show article list.
 */
function showIndex() {
    document.getElementById('index-article-view').classList.add('hidden');
    document.getElementById('index-article-list').classList.remove('hidden');
}

function loadArticleList() {
    var ul = document.querySelector('#index-article-list').getElementsByTagName('ul')[0];

    function success(response) {
        var resData = JSON.parse(response);
        resData.forEach(value => {
            var el = new Article(value.fileName, value.title, value.content, (new Date(value.date)).toLocaleString());
            ul.appendChild(el.node);
        });
    }

    function fail() {
        var newLine = document.createElement('li');
        newLine.innerText = `List Load Faild :-(`;
        ul.appendChild(newLine);
    }

    var request = new XMLHttpRequest(); // New XMLHttpRequest Object

    request.onreadystatechange = () => { // invoked when readyState changes
        if (request.readyState === 4) { // request succeed
            // response result:
            if (request.status === 200) {
                // succeed: update article
                return success(request.response);
            } else {
                // failed: show error code
                return fail();
            }
        }
    }

    // send request
    request.open('GET', '/api/archive-list');
    request.send();
}

function loadArticleContent(fileName, fromState) {
    function success(response) {
        if (!fromState) {
            history.pushState({
                originTitle: fileName,
                type: 'archive',
                originPathName: window.location.pathname
            },
                fileName,
                `/archive/${fileName}`
            );
        }
        document.getElementById('index-article-view').classList.remove('hidden');
        document.getElementById('index-article-list').classList.add('hidden');

        document.getElementById('index-article-title').innerText = fileName;
        document.getElementById('index-article-content').innerText = response;
    }

    function fail(code) {
        document.getElementById('index-article-title').innerText = 'Article Load Faild: Please Refresh Page And Try Again.';
        document.getElementById('index-article-content').innerText += `Error Code: ${code}`;
    }

    var request = new XMLHttpRequest();

    request.onreadystatechange = () => {
        if (request.readyState === 4) {
            if (request.status === 200) {
                return success(request.response);
            } else {
                return fail(request.status);
            }
        }
    }

    request.open('GET', `/archive/${fileName}`);
    request.setRequestHeader('pushState-Ajax', true);
    request.send();
}

function loadMusicRecord() {
    var ul = document.getElementById('index-music-record');

    function success(rawList) {
        rawList.forEach((value, index) => {
            if (index > 9) return;
            var el = new SideListItem(
                `${value.name} - ${value.artistName}`,
                `http://music.163.com/#/song?id=${value.id}`,
                `_blank`
            );
            el.node.setAttribute('title', el.node.innerText);
            ul.appendChild(el.node);
        });
    }

    function fail() {
        ul.innerText = 'Music Record Load Faild :-(';
    }

    var request = new XMLHttpRequest();

    request.onreadystatechange = () => {
        if (request.readyState === 4) {
            if (request.status === 200) {
                var rawList = JSON.parse(request.response);
                return success(rawList);
            } else {
                return fail();
            }
        }
    }

    request.open('GET', `/api/music-record`);
    request.send();
}

window.onload = () => {
    console.log('Welcome to Rocka\'s Node Blog! ');
    loadArticleList();
    loadMusicRecord();
    document.getElementById('view-gotoIndex').onclick = e => {
        e.preventDefault();
        history.pushState({ originTitle: '', type: 'index', originPathName: window.location.pathname }, '', '/');
        showIndex();
    }
}

window.onpopstate = (e) => {
    if (!e.state) {
        var pn = window.location.pathname;
        var archiveRegex = /\/archive\/(.+)/
        if (pn === '/') {
            showIndex();
        } else if (archiveRegex.test(pn)) {
            loadArticleContent(archiveRegex.exec(pn)[1]);
        }
    }
    else if (e.state.type === 'index') {
        showIndex();
    } else if (e.state.type === 'archive') {
        loadArticleContent(e.state.originTitle, true);
    }
}
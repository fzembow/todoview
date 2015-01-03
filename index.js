#! /usr/bin/env node

var express = require('express'),
    fs = require('fs-extended'),
    open = require('open'),
    path = require('path'),
    Promise = require('bluebird'),
    WebSocketServer = require('ws').Server;


// This is the default config. If the directory from which todoview
// is run contains a .todoview file, the config from that is used
// instead.
var config = {
  blacklist: [
    "^node_modules"
  ],
  fileChangePollingInterval: 5000,
  includeHidden: false,
  linesToShow: 9,
  onlyAllowLocalhost: true,
  port: 10025,
  webSocketPort: 8080,
};


// Keep track of last modified time for all the files accessed to not
// reprocess things needlessly.
var mtimes = {};


// Keep track of TODOs per file in order to only update the
// frontend when those files change.
var filesWithTodos = {};


// TODO: Make this an Emitter?
// Emit filenames when they are encountered and stream their processing.
// Might be a premature optimization...
function listFiles(filepath) {
  return new Promise(function(resolve) {
    fs.listFiles(filepath, { recursive: 1 }, function (err, files) {
      files = files.filter(function(f) {
        var visible = config.includeHidden || !f.match(/^\.|\/.\//);
        var blacklisted = config.blacklist.some(function(pattern) {
          return f.match(pattern);
        });

        return visible && !blacklisted;
      });
      resolve(files);
    });
  });
}


function findTodosInFiles(filenames) {
  return new Promise(function(resolve) {
    Promise.all(filenames.map(findTodosInFile)).then(function(data) {
      // Remove any empty files from the data.
      resolve(data.filter(function(d) { return d.todos.length > 0; }));
    });
  });
}


function findTodosInFile(filename) {

  return new Promise(function(resolve) {
    fs.readFile(filename, {encoding: "utf-8"}, function(err, data){

      fs.stat(filename, function(err, stats){
        if (err) throw err;
        mtimes[filename] = stats.mtime;
      });

      if (err) {
        resolve({});
        return;
      }

      var todos = [];
      var lines = data.split("\n");

      lines.forEach(function(line, lineIndex) {
        // TODO: Better regex to match TODOs anywhere within a block comment,
        // and also PHP, HTML, bash, and other languages comments.
        // In all likelihood, this would depend on the file extension.
        if (!line.match(/^\s*\/\/\s*TODO/)) return;

        var startLineIndex = Math.max(0, lineIndex - config.linesToShow);

        // Find bottom of multi line TODOs
        var todoEndLineIndex = lineIndex;
        do {
          todoEndLineIndex++;
          // If line is not a comment line, then consider the comment done.
          if (!lines[todoEndLineIndex].match(/^\s*\/\//)) break;

          // If blank comment line,then this todo is done.
          if (lines[todoEndLineIndex].match(/^\s*\/\/\s*$/)) break;
        } while (todoEndLineIndex < lines.length -1);

        todoEndLineIndex--;

        var endLineIndex = Math.min(lines.length - 1, todoEndLineIndex + config.linesToShow + 1);

        var todo = {
          startLineNumber: startLineIndex + 1,
          startTodoLineNumber: lineIndex + 1,
          endTodoLineNumber: todoEndLineIndex + 1,
          endLineNumber: endLineIndex + 1,
          lines: lines.slice(startLineIndex, endLineIndex),
        };
        todos.push(todo);
      });

      var fileInfo = {
        filename: filename,
        extension: path.extname(filename).slice(1),
        todos: todos
      }
      if (todos.length) {
        filesWithTodos[filename] = todos.length;
      } else {
        if (filesWithTodos[filename] && filesWithTodos[filename] > 0 ) {
          fileInfo.hadTodos = true;
        }
        delete filesWithTodos[filename];
      }
      resolve(fileInfo);
    });
  });
}


/*
 * Runs a local web server to show the files.
 */
function runServer(data) {

  // TODO: Load any .todoview files and parse them into the config.

  var app = express();

  app.use('/static', express.static(__dirname + '/static'));

  app.get('/', function(req, res){
    // TODO: Only re-parse the template for development.
    fs.readFile(__dirname + '/templates/index.html', {encoding: "utf-8"}, function(err, template) {
      res.send(template);
    });
  });

  app.get('/todos', function(req, res){

    if (config.onlyAllowLocalhost && req.hostname != 'localhost') {
      res.send('[]');
      return;
    }

    listFiles(".")
      .then(findTodosInFiles)
      .then(function(d){
        res.json(d);
      });
  });

  app.get('/config', function(req, res){
    res.json(config); 
  });

  app.post('/config', function(req, res){
    // TODO: Save the config to the .todoview file in this directory.
    console.log(req.body);
  });

  app.listen(config.port, function(){
    open('http://localhost:' + config.port);
  });
}


/*
 * Runs a web socket server to push update notifications to the client.
 */
function runWebSocketServer() {
  var wss = new WebSocketServer({ port: config.webSocketPort });

  wss.broadcast = function broadcast(msg) {
    for(var i in this.clients) {
      this.clients[i].send(msg);
    }
    return msg;
  };

  wss.update = wss.broadcast.bind(wss, 'update');
  return wss;
}


/*
 * Checks for updates to any files being watched.
 * Resolves to true when an update is needed, and false if nothing has changed.
 * - If a file with known TODOs was updated, update it.
 * - If a file without known TODOs was updated, and a TODO was added, update it.
 */
function checkForUpdatesToTodos() {
  return new Promise(function(resolve) {
    listFiles(".").then(function(filenames) {

      filenames.forEach(function(filename) {

        fs.stat(filename, function(err, stats){
          if (err) throw err;
          if (stats.mtime <= mtimes[filename]) {
            return;
          }

          mtimes[filename] = stats.mtime;

          findTodosInFile(filename).then(function(fileinfo){
            // TODO: Optimize this so that spurious updates aren't sent down.
            // For example, if there's a change but it doesn't affect anything
            // shown in the frontend (eg, line numbers don't change and the edit
            // isn't in a TODO line), then don't push an update.
            if (fileinfo.todos.length || fileinfo.hadTodos) {
              resolve(true);
            }
          });
        });
      });
    });
  });
}


if (!module.parent) {
  runServer();
  var wss = runWebSocketServer();

  setInterval(function(){
    checkForUpdatesToTodos().then(function(needsUpdate){
      if (needsUpdate) {
        wss.update();
      }
    });
  }, config.fileChangePollingInterval);
}

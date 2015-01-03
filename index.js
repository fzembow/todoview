#! /usr/bin/env node

var bodyParser = require('body-parser'),
    express = require('express'),
    fs = require('fs-extended'),
    open = require('open'),
    path = require('path'),
    Promise = require('bluebird'),
    WebSocketServer = require('ws').Server;

var CONFIG_FILENAME = path.join(process.cwd(), '.todoview');

// This is the default config. If the directory from which todoview
// is run contains a .todoview file, the config from that is used
// instead.
var DEFAULT_CONFIG = {
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

// This is the config for the currently running instance. It's filled
// using the values in the .todoview file, if present, or the defaults
// if missing.
var config = {};

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
    fs.readFile(filename, {encoding: "utf8"}, function(err, data){

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
 * Loads the configuration on initial load.
 */
function loadConfig(){
  return new Promise(function(resolve){
    fs.readFile(CONFIG_FILENAME, {encoding: "utf8"}, function(err, data) {
      if (err) {
        config = DEFAULT_CONFIG;
      } else {
        try {
          var json = JSON.parse(data);
          if (validateConfig(json)) {
            config = json;
          } else {
            console.log("WARNING: The todoview config in %s is not valid, using default config instead.", CONFIG_FILENAME);
            config = DEFAULT_CONFIG;
          }
        } catch (e) {
          console.log("WARNING: The todoview config in %s is not valid JSON, using default config instead.", CONFIG_FILENAME);
          config = DEFAULT_CONFIG;
        }
      }
      resolve(true);
    });
  });
}


/*
 * Runs a local web server to show the files.
 */
function runWebServer(data) {

  var app = express();

  app.use(bodyParser.json());

  app.use('/static', express.static(__dirname + '/static'));

  app.get('/', function(req, res){
    // TODO: Only re-parse the template for development.
    fs.readFile(__dirname + '/templates/index.html', {encoding: "utf8"}, function(err, template) {
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
    if (validateConfig(req.body)){

      config = req.body;

      fs.writeFile(CONFIG_FILENAME, JSON.stringify(req.body), {encoding: "utf8"}, function(err){
        if (err) console.log(err);
        res.sendStatus(200);
      });
      
    } else {
      // TODO: Send a 50x when the config isn't valid on the server.
    }
  });

  return new Promise(function(resolve) {
    app.listen(config.port, function(){
      open('http://localhost:' + config.port);
      resolve(true);
    });
  });
}


/*
 * Validates a config, returning it if it's valid.
 */
function validateConfig(config){
  // TODO: Actually validate configs.
  // First, check if the config is a string and try to JSON.parse it.
  // This should also cast values to the right format. For example,
  // numbers should be parsed as integers and not strings.
  return true;
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

  // Shorthand for sending the 'update' message to all clients.
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
  loadConfig().then(function(){
    
    var wss = runWebSocketServer();

    runWebServer().then(function(){
      setInterval(function(){
        checkForUpdatesToTodos().then(function(needsUpdate){
          if (needsUpdate) wss.update();
        });
      }, config.fileChangePollingInterval);
    });
  });
}

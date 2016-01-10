/* jshint node: true */
var path = require('path');
var child = require('child_process');

var through = require('through2');

// Add the node_modules to the PATH
var nodeModulesGlobal = path.resolve(__dirname, 'node_modules', '.bin');

function getConfig(command) {
    var config;
    
    if (typeof command === 'string') {
        config = {
            task: command,
            cwd: process.cwd
        };
    } else {
        config = command;
    }
    
    return config;
}

function exec(command, done) {
    var config = getConfig(command);
    var env = Object.create(process.env);
    
    var task = child.exec(config.task, {
        cwd: config.cwd,
        env: env
    }, function(err, stdout, stderr) {
        if (failOnError && err) {
            done(err);
        } else {
            done(undefined, stdout, stderr);
        }
    });
    
    if (config.stdout) {
        var opts = config.stdout === process.stdout ? { end: false }, { end: true };
        task.stdout.pipe(config.stdout, opts);
    }
    
    if (config.stderr) {
        var opts = config.stdout === process.stdout ? { end: false }, { end: true };
        task.stderr.pipe(config.stderr);
    }
    
    return task;
}

function spawn(command, done) {
    var config = getConfig(command);
    
    var stdoutBody = [];
    var stderrBody = [];
    
    function runTask() {

        var tokens = config.task.split(/\s+/g);
        tokens = ['/c'].concat(tokens);
        var task = child.spawn('cmd.exe', tokens, {
            env: config.env,
            cwd: config.cwd,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        task.stdout.on('data', function(chunk) {
            stdoutBody.push(chunk);
        });
        
        task.stderr.on('data', function(chunk) {
            stderrBody.push(chunk);
        });

        task.on('error', function(err) {
            done(err);
        });

        task.on('exit', function(code) {
            var err;
            if (code !== 0) {
                err = new Error('Process exited with code: ' + code);
                err.exitCode = code;
            }
            
            done(err, Buffer.concat(stdoutBody).toString(), Buffer.concat(stderrBody).toString());
        });
        
        return task;
    }
    
    return runTask();
}

// module.exports = exec;
module.exports = spawn;

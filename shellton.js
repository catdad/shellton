/* jshint node: true */

var path = require('path');
var child = require('child_process');
var async = require('async');

// Add the node_modules to the PATH
var nodeModulesGlobal = path.resolve(__dirname, 'node_modules', '.bin');
var platform = /^win/.test(process.platform) ? 'win' : 'nix';

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

function isIOStream(stream) {
    return process.stdin === stream ||
        process.stdout === stream ||
        process.stderr === stream;
}

function pipeStream(from, to, config) {
    var opts = isIOStream(to) ? { end: false } : { end: true };
    from.pipe(to, opts);
}

function exec(command, done) {
    var config = getConfig(command);
    
    var task = child.exec(config.task, {
        cwd: config.cwd || process.cwd(),
        env: config.env || process.env
    }, function(err, stdout, stderr) {
        done(err, stdout, stderr);
    });
    
    if (config.stdout) {
        pipeStream(task.stdout, config.stdout);
    }
    
    if (config.stderr) {
        pipeStream(task.stderr, config.stderr);
    }
    
    return task;
}

function spawn(command, done) {
    var config = getConfig(command);
    var env = config.env || Object.create(process.env);
    
    var stdoutBody = [];
    var stderrBody = [];
    
    var stdio = [ 'ignore', 'pipe', 'pipe' ];
    var pipeStdout = true;
    var pipeStderr = true;
    
    if (isIOStream(config.stdout)) {
        stdio[1] = config.stdout;
        pipeStdout = false;
    }
    
    if (isIOStream(config.stderr)) {
        stdio[2] = config.stderr;
        pipeStderr = false;
    }
    
    var executable = platform === 'win' ? 'cmd.exe' : 'bash';
    var firstToken = platform === 'win' ? '/c' : '-c';
    var tokens = [firstToken, config.task];
    
    var task = child.spawn(executable, tokens, {
        env: config.env || process.env,
        cwd: config.cwd || process.cwd(),
        stdio: stdio
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
    
    async.parallel({
        stdout: function(next) {
            task.stdout.on('end', function() {
                next();
            });
        },
        stderr: function(next) {
            task.stderr.on('end', function() {
                next();
            });
        },
        exitCode: function(next) {
            task.on('exit', function(code) {
                var err;
                if (code !== 0) {
                    err = new Error('Process exited with code: ' + code);
                    err.code = code;
                }
                next(err);
            });
        }
    }, function(err, results) {
        if (err) {
            return done(err);
        }
        
        done(undefined, Buffer.concat(stdoutBody).toString(), Buffer.concat(stderrBody).toString());
    });
    
    if (pipeStdout && config.stdout) {
        pipeStream(task.stdout, config.stdout);
    }
    
    if (pipeStderr && config.stderr) {
        pipeStream(task.stderr, config.stderr);
    }

    return task;
}

// module.exports = exec;
module.exports = spawn;

module.exports.spawn = spawn;
module.exports.exec = exec;

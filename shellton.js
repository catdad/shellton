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
    
    if (config.stdin) {
        config.stdin.pipe(task.stdin);
    }
    
    return task;
}

function spawn(command, done) {
    var config = getConfig(command);
    var env = config.env || Object.create(process.env);
    
    var stdio = [ 'pipe', 'pipe', 'pipe' ];
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
    
    task.on('error', function(err) {
        done(err);
    });
    
    var parallelTasks = {
        stdout: function(next) {
            var stdoutBody = [];
    
            task.stdout.on('data', function(chunk) {
                stdoutBody.push(chunk);
            });

            task.stdout.on('end', function() {
                next(undefined, Buffer.concat(stdoutBody).toString());
            });
        },
        stderr: function(next) {
            var stderrBody = [];
    
            task.stderr.on('data', function(chunk) {
                stderrBody.push(chunk);
            });
            
            task.stderr.on('end', function() {
                next(undefined, Buffer.concat(stderrBody).toString());
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
    };
    
    /*
    if (config.stdin && config.stdin.pipe) {
        // TODO is this right?
//        task.stdin.setEncoding('utf-8');
        config.stdin.pipe(task.stdin, { end: 'false' });
        
        // add a task to make sure this stream ends as well,
        // before exiting the task
        parallelTasks.stdin = function(next) {
//            config.stdin.on('data', function(chunk) {
//                console.log('in chunk', chunk.toString());
//                task.stdin.write(chunk.toString());
//            });
            config.stdin.on('end', function() {
                task.stdin.end();
                next();
            });
        };
    }
    */
    
    async.parallel(parallelTasks, function(err, results) {
        if (err) {
            return done(err);
        }
        
        done(undefined, results.stdout, results.stderr);
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

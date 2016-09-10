/* jshint node: true */

var path = require('path');
var child = require('child_process');

var async = require('async');
var _ = require('lodash');

// Add the node_modules to the PATH
var nodeModulesBin = path.resolve(__dirname, 'node_modules', '.bin');
var platform = /^win/.test(process.platform) ? 'win' : 'nix';

function validateFunction(obj) {
    return (obj && ({}).toString.call(obj) === '[object Function]') ?
        obj : 
        _.noop;
}

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

function getEnv(config) {
    var env = _.extend({}, config.env || {}, process.env);
    var envPath = env.PATH || env.Path || env.path;
    envPath = envPath.replace(new RegExp(path.delimiter + '$'), '');
    envPath += path.delimiter + nodeModulesBin;
    
    // overwrite both, because Windows
    env.PATH = env.Path = envPath;
    
    return env;
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

function collectStream(stream, callback) {
    var body = [];
    
    stream.on('data', function(chunk) {
        body.push(chunk);
    });

    stream.on('end', function() {
        callback(undefined, Buffer.concat(body).toString());
    });
}

function exec(command, done) {
    var config = getConfig(command);
    done = validateFunction(done);
    
    var task = child.exec(config.task, {
        cwd: config.cwd || process.cwd(),
        env: getEnv(config)
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
    done = validateFunction(done);
    var config = getConfig(command);
    
    var stdio = [ 'pipe', 'pipe', 'pipe' ];
    var pipeStdout = true;
    var pipeStderr = true;
    
//    if (isIOStream(config.stdout)) {
//        stdio[1] = config.stdout;
//        pipeStdout = false;
//    }
//    
//    if (isIOStream(config.stderr)) {
//        stdio[2] = config.stderr;
//        pipeStderr = false;
//    }
    
    var executable = platform === 'win' ? 'cmd.exe' : 'bash';
    var firstToken = platform === 'win' ? '/c' : '-c';
    var tokens = [firstToken, config.task];
    
    var task = child.spawn(executable, tokens, {
        env: getEnv(config),
        cwd: config.cwd || process.cwd(),
        stdio: stdio
    });
    
    task.on('error', function(err) {
        done(err);
    });
    
    var parallelTasks = {
        stdout: function(next) {
            collectStream(task.stdout, next);
        },
        stderr: function(next) {
            collectStream(task.stderr, next);
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
    
    if (config.stdin && config.stdin.pipe) {
        config.stdin.pipe(task.stdin);
        
        // add a task to make sure this stream ends as well,
        // before exiting the task
        parallelTasks.stdin = function(next) {
            config.stdin.on('end', next);
        };
    }
    
    async.parallel(parallelTasks, function(err, results) {
        done(err || null, results.stdout, results.stderr);
    });
    
    if (pipeStdout && config.stdout) {
        pipeStream(task.stdout, config.stdout);
    }
    
    if (pipeStderr && config.stderr) {
        pipeStream(task.stderr, config.stderr);
    }

    return task;
}

function extendToString(target) {
    var args = [].slice.call(arguments, 1);
    
    function extend(to, from) {
        for (var i in from) {
            to[i] = from[i].toString();
        }
        
        return to;
    }
    
    args.forEach(function(val) {
        extend(target, val);
    });
    
    return target;
}

function env(obj) {
    var copy = extendToString({}, process.env);
    
    if (!obj || typeof obj !== 'object') {
        return copy;
    }
    
    return extendToString(copy, obj);
}

// module.exports = exec;
module.exports = spawn;

module.exports.spawn = spawn;
module.exports.exec = exec;

module.exports.env = env;

/* jshint node: true */

var path = require('path');
var child = require('child_process');

var async = require('async');
var _ = require('lodash');

// Add the node_modules to the PATH
var nodeModulesBin = path.resolve(__dirname, 'node_modules', '.bin');
var parentNodeModulesBin = path.resolve(__dirname, '..', '.bin');
var platform = /^win/.test(process.platform) ? 'win' : 'nix';

function validateFunction(obj) {
    return _.isFunction(obj) ? obj : _.noop;
}

function getConfig(command) {
    var config = (typeof command === 'string') ? {
        task: command,
        cwd: process.cwd
    } : command;
    
    config.output = config.output === 'buffer' ? 'buffer' : 'utf8';
    
    return config;
}

function mergePaths() {
    
    var mergedPath = [].slice.call(arguments).reduce(function(memo, arg) {
        var p = arg.PATH || arg.Path || arg.path;

        if (!(_.isString(p) && p.length)) {
            return memo;
        }

        p = p.trim().replace(new RegExp(path.delimiter + '$'), '');

        return memo.concat(p.split(path.delimiter));
    }, []).join(path.delimiter);
    
    // because Windows, we need to overwrite all 3
    return {
        PATH: mergedPath,
        Path: mergedPath,
        path: mergedPath
    };
}

function getEnv(config) {
    return newEnv(config.env, mergePaths(
        config.env || {},
        process.env,
        { PATH: nodeModulesBin },
        { PATH: parentNodeModulesBin }
    ));
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

function collectStream(stream, encoding, callback) {
    var body = [];
    
    stream.on('data', function(chunk) {
        body.push(chunk);
    });

    stream.on('end', function() {
        var out = Buffer.concat(body);
        
        if (encoding !== 'buffer') {
            out = out.toString();
        }
        
        callback(undefined, out);
    });
}

function exec(command, done) {
    var config = getConfig(command);
    done = validateFunction(done);
    
    var task = child.exec(config.task, {
        cwd: config.cwd || process.cwd(),
        env: getEnv(config),
        encoding: config.output
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
    
    var opts = {
        env: getEnv(config),
        cwd: config.cwd || process.cwd(),
        stdio: stdio
    };
    
    if (platform === 'win') {
        opts.windowsVerbatimArguments = config.windowsVerbatimArguments !== false;
    }
    
    var task = child.spawn(executable, tokens, opts);
    
    task.on('error', function(err) {
        done(err);
    });
    
    var parallelTasks = {
        stdout: function(next) {
            collectStream(task.stdout, config.output, next);
        },
        stderr: function(next) {
            collectStream(task.stderr, config.output, next);
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
    
    args.forEach(extend.bind(null, target));
    
    return target;
}

function newEnv() {
    return extendToString.apply(
        null,
        [_.cloneDeep(process.env)].concat(_.filter(arguments, _.isPlainObject))
    );
}

// module.exports = exec;
module.exports = spawn;

module.exports.spawn = spawn;
module.exports.exec = exec;

module.exports.env = newEnv;
